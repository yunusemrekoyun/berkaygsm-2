function toId(value) {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    if (typeof value.id === "string") return value.id.trim();
    if (typeof value._id === "string") return value._id.trim();
    if (typeof value.toHexString === "function") return value.toHexString();
    if (
      typeof value.toString === "function" &&
      value.toString !== Object.prototype.toString
    ) {
      const normalized = String(value.toString()).trim();
      if (normalized && normalized !== "[object Object]") return normalized;
    }
  }
  return "";
}

export function roundCurrency(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function normalizeIdList(list = []) {
  return Array.from(
    new Set(
      (Array.isArray(list) ? list : [])
        .map((entry) => toId(entry))
        .filter(Boolean)
    )
  );
}

function normalizeTargets(rawTargets = {}) {
  const source =
    rawTargets && typeof rawTargets === "object" ? rawTargets : {};
  return {
    products: normalizeIdList(source.products || []),
    sets: normalizeIdList(source.sets || []),
    categories: normalizeIdList(source.categories || []),
  };
}

function buildTargetLookups(rawTargets = {}) {
  const normalized = normalizeTargets(rawTargets);
  return {
    normalized,
    products: new Set(normalized.products),
    sets: new Set(normalized.sets),
    categories: new Set(normalized.categories),
  };
}

function hasTargets(rawTargets = {}) {
  const targets = normalizeTargets(rawTargets);
  return Boolean(
    targets.products.length || targets.sets.length || targets.categories.length
  );
}

function normalizeStandardDiscount(discount) {
  if (!discount || typeof discount !== "object") return null;
  const percentage = Number(discount.percentage || 0);
  if (!Number.isFinite(percentage) || percentage <= 0) return null;
  return {
    id: toId(discount.id || discount._id) || null,
    name: String(discount.name || "").trim(),
    percentage: roundCurrency(percentage),
    allowCouponStacking: discount.allowCouponStacking !== false,
    allowStackedDiscountStacking:
      discount.allowStackedDiscountStacking !== false,
  };
}

function normalizeCoupon(coupon) {
  if (!coupon || typeof coupon !== "object") return null;
  const percentage = Number(coupon.percentage || 0);
  if (!Number.isFinite(percentage) || percentage <= 0) return null;
  return {
    code: String(coupon.code || "").trim(),
    percentage: roundCurrency(percentage),
    minSubtotal: roundCurrency(Number(coupon.minSubtotal || 0)),
    targets: normalizeTargets(coupon.targets || {}),
    template: coupon.template || null,
    audience: coupon.audience || null,
  };
}

function normalizeTiers(tiers = []) {
  return (Array.isArray(tiers) ? tiers : [])
    .map((tier) => ({
      quantity: Math.max(1, Math.floor(Number(tier?.quantity || 0))),
      percentage: roundCurrency(Number(tier?.percentage || 0)),
    }))
    .filter(
      (tier) =>
        Number.isFinite(tier.quantity) &&
        tier.quantity > 0 &&
        Number.isFinite(tier.percentage) &&
        tier.percentage > 0
    )
    .sort((left, right) => left.quantity - right.quantity);
}

function normalizeStackedDiscount(config) {
  if (!config || typeof config !== "object") return null;
  const tiers = normalizeTiers(config.tiers || []);
  return {
    id: toId(config.id || config._id) || null,
    active: config.active !== false,
    allowCouponStacking: config.allowCouponStacking !== false,
    allowDiscountStacking: config.allowDiscountStacking !== false,
    targets: normalizeTargets(config.targets || {}),
    tiers,
  };
}

function getActiveTier(tiers = [], quantity = 0) {
  const safeQuantity = Math.max(0, Math.floor(Number(quantity || 0)));
  return [...tiers]
    .reverse()
    .find((tier) => safeQuantity >= Number(tier.quantity || 0)) || null;
}

function getNextTier(tiers = [], quantity = 0) {
  const safeQuantity = Math.max(0, Math.floor(Number(quantity || 0)));
  return tiers.find((tier) => Number(tier.quantity || 0) > safeQuantity) || null;
}

function lineMatchesTargets(line, lookups, { emptyMeansAll = false } = {}) {
  const sourceLookups =
    lookups && typeof lookups === "object" && "products" in lookups
      ? lookups
      : buildTargetLookups(lookups || {});
  const normalizedTargets = sourceLookups.normalized || normalizeTargets({});
  const hasScopedTargets = Boolean(
    normalizedTargets.products.length ||
      normalizedTargets.sets.length ||
      normalizedTargets.categories.length
  );

  if (!hasScopedTargets) return emptyMeansAll;

  const kind = String(line?.kind || "product").toLowerCase() === "set"
    ? "set"
    : "product";
  const refId = toId(line?.ref || line?.id);
  if (!refId) return false;

  if (kind === "set") {
    return sourceLookups.sets.has(refId);
  }

  if (sourceLookups.products.has(refId)) return true;
  if (!sourceLookups.categories.size) return false;

  const categoryIds = normalizeIdList(line?.categoryIds || []);
  return categoryIds.some((categoryId) => sourceLookups.categories.has(categoryId));
}

function allocateDiscount(linePool = [], totalDiscount = 0, valueSelector) {
  const safeTotalDiscount = roundCurrency(totalDiscount);
  if (safeTotalDiscount <= 0 || !linePool.length) {
    return new Map(linePool.map((line) => [line.lineId, 0]));
  }

  const weighted = linePool
    .map((line, index) => ({
      lineId: line.lineId,
      index,
      value: Math.max(0, Number(valueSelector(line) || 0)),
    }))
    .filter((entry) => entry.value > 0);

  if (!weighted.length) {
    return new Map(linePool.map((line) => [line.lineId, 0]));
  }

  const totalValue = weighted.reduce((sum, entry) => sum + entry.value, 0);
  if (totalValue <= 0) {
    return new Map(linePool.map((line) => [line.lineId, 0]));
  }

  const totalCents = Math.round(safeTotalDiscount * 100);
  const provisional = weighted.map((entry) => {
    const rawCents = (totalCents * entry.value) / totalValue;
    const cents = Math.floor(rawCents);
    return {
      ...entry,
      cents,
      remainder: rawCents - cents,
    };
  });

  let assignedCents = provisional.reduce((sum, entry) => sum + entry.cents, 0);
  const ranked = [...provisional].sort((left, right) => {
    if (right.remainder !== left.remainder) {
      return right.remainder - left.remainder;
    }
    return left.index - right.index;
  });

  let cursor = 0;
  while (assignedCents < totalCents && ranked.length) {
    ranked[cursor % ranked.length].cents += 1;
    assignedCents += 1;
    cursor += 1;
  }

  const allocation = new Map(linePool.map((line) => [line.lineId, 0]));
  provisional.forEach((entry) => {
    allocation.set(entry.lineId, roundCurrency(entry.cents / 100));
  });
  return allocation;
}

function normalizeLine(line = {}, index = 0) {
  const kind =
    String(line.kind || "product").toLowerCase() === "set" ? "set" : "product";
  const ref = toId(line.ref || line.id || line.productId || line.setId);
  if (!ref) return null;

  const qty = Math.max(1, Math.floor(Number(line.qty || 1) || 1));
  const baseUnitPrice = roundCurrency(
    Number(
      line.baseUnitPrice ??
        line.originalPrice ??
        line.price ??
        line.unitPrice ??
        line.finalPrice ??
        0
    ) || 0
  );

  return {
    ...line,
    lineId:
      String(line.lineId || "").trim() || `${kind}:${ref}:${index}:${qty}`,
    kind,
    ref,
    qty,
    baseUnitPrice,
    categoryIds: normalizeIdList(line.categoryIds || []),
    standardDiscount: normalizeStandardDiscount(
      line.standardDiscount || line.discount || line.discountMeta || null
    ),
  };
}

function buildScenario({
  lines = [],
  stackedDiscount = null,
  coupon = null,
}) {
  const couponSummary = normalizeCoupon(coupon);
  const stackedConfig = normalizeStackedDiscount(stackedDiscount);

  const stackedTargets = buildTargetLookups(stackedConfig?.targets || {});
  const couponTargets = buildTargetLookups(couponSummary?.targets || {});

  const preparedLines = lines.map((line) => ({
    ...line,
    lineBaseTotal: roundCurrency(line.baseUnitPrice * line.qty),
    stackedEligible:
      Boolean(stackedConfig?.active) &&
      lineMatchesTargets(line, stackedTargets, { emptyMeansAll: false }),
    couponEligible:
      Boolean(couponSummary) &&
      lineMatchesTargets(line, couponTargets, { emptyMeansAll: true }),
  }));

  const eligibleQuantity = preparedLines
    .filter((line) => line.stackedEligible)
    .reduce((sum, line) => sum + line.qty, 0);

  const activeTier = stackedConfig?.active
    ? getActiveTier(stackedConfig.tiers, eligibleQuantity)
    : null;
  const nextTier =
    stackedConfig?.active && stackedConfig.tiers.length
      ? getNextTier(stackedConfig.tiers, eligibleQuantity)
      : null;

  const stackedDisabledByCoupon = Boolean(
    couponSummary &&
      activeTier &&
      stackedConfig?.allowCouponStacking === false &&
      preparedLines.some((line) => line.stackedEligible && line.couponEligible)
  );

  const linesAfterStandard = preparedLines.map((line) => {
    const standardDiscount = line.standardDiscount;
    let standardRemovedBy = null;
    let standardApplied = Boolean(standardDiscount);

    if (
      standardApplied &&
      couponSummary &&
      line.couponEligible &&
      standardDiscount.allowCouponStacking === false
    ) {
      standardApplied = false;
      standardRemovedBy = "coupon";
    }

    if (
      standardApplied &&
      activeTier &&
      !stackedDisabledByCoupon &&
      line.stackedEligible &&
      (stackedConfig?.allowDiscountStacking === false ||
        standardDiscount.allowStackedDiscountStacking === false)
    ) {
      standardApplied = false;
      standardRemovedBy = "stacked";
    }

    const unitPriceAfterStandard = standardApplied
      ? roundCurrency(
          line.baseUnitPrice -
            (line.baseUnitPrice * standardDiscount.percentage) / 100
        )
      : line.baseUnitPrice;
    const lineTotalAfterStandard = roundCurrency(
      unitPriceAfterStandard * line.qty
    );

    return {
      ...line,
      standardDiscountApplied: standardApplied,
      standardDiscountRemovedBy: standardRemovedBy,
      standardDiscountAmount: roundCurrency(
        line.lineBaseTotal - lineTotalAfterStandard
      ),
      unitPriceAfterStandard,
      lineTotalAfterStandard,
    };
  });

  const stackedPool =
    activeTier && !stackedDisabledByCoupon
      ? linesAfterStandard.filter((line) => line.stackedEligible)
      : [];
  const stackedEligibleSubtotal = roundCurrency(
    stackedPool.reduce((sum, line) => sum + line.lineTotalAfterStandard, 0)
  );
  const stackedDiscountAmount =
    activeTier && !stackedDisabledByCoupon
      ? roundCurrency(
          (stackedEligibleSubtotal * Number(activeTier.percentage || 0)) / 100
        )
      : 0;
  const stackedAllocation = allocateDiscount(
    stackedPool,
    stackedDiscountAmount,
    (line) => line.lineTotalAfterStandard
  );

  const linesAfterStacked = linesAfterStandard.map((line) => {
    const stackedAmount = roundCurrency(stackedAllocation.get(line.lineId) || 0);
    const lineTotalBeforeCoupon = roundCurrency(
      line.lineTotalAfterStandard - stackedAmount
    );
    return {
      ...line,
      stackedDiscountAmount: stackedAmount,
      lineTotalBeforeCoupon,
      unitPriceBeforeCoupon: roundCurrency(lineTotalBeforeCoupon / line.qty),
      stackedDiscountApplied: stackedAmount > 0,
      stackedDiscountTier: activeTier
        ? {
            quantity: activeTier.quantity,
            percentage: activeTier.percentage,
          }
        : null,
    };
  });

  const subtotalBeforeCoupon = roundCurrency(
    linesAfterStacked.reduce((sum, line) => sum + line.lineTotalBeforeCoupon, 0)
  );
  const couponPool = couponSummary
    ? linesAfterStacked.filter((line) => line.couponEligible)
    : [];
  const couponEligibleSubtotal = roundCurrency(
    couponPool.reduce((sum, line) => sum + line.lineTotalBeforeCoupon, 0)
  );
  const couponApplicable = Boolean(
    couponSummary &&
      couponEligibleSubtotal >= Number(couponSummary.minSubtotal || 0) &&
      couponEligibleSubtotal > 0
  );
  const couponDiscountAmount = couponApplicable
    ? roundCurrency(
        (couponEligibleSubtotal * Number(couponSummary.percentage || 0)) / 100
      )
    : 0;
  const couponAllocation = allocateDiscount(
    couponPool,
    couponDiscountAmount,
    (line) => line.lineTotalBeforeCoupon
  );

  const pricedLines = linesAfterStacked.map((line) => {
    const couponAmount = couponApplicable
      ? roundCurrency(couponAllocation.get(line.lineId) || 0)
      : 0;
    const finalLineTotal = roundCurrency(line.lineTotalBeforeCoupon - couponAmount);
    return {
      ...line,
      couponDiscountAmount: couponAmount,
      finalLineTotal,
      finalUnitPrice: roundCurrency(finalLineTotal / line.qty),
    };
  });

  return {
    lines: pricedLines,
    baseSubtotal: roundCurrency(
      preparedLines.reduce((sum, line) => sum + line.lineBaseTotal, 0)
    ),
    standardDiscountAmount: roundCurrency(
      pricedLines.reduce((sum, line) => sum + line.standardDiscountAmount, 0)
    ),
    stackedDiscountAmount: roundCurrency(
      pricedLines.reduce((sum, line) => sum + line.stackedDiscountAmount, 0)
    ),
    subtotalBeforeCoupon,
    coupon: couponSummary
      ? {
          ...couponSummary,
          applicable: couponApplicable,
          eligibleSubtotal: couponEligibleSubtotal,
          discountAmount: couponDiscountAmount,
        }
      : null,
    finalSubtotal: roundCurrency(
      pricedLines.reduce((sum, line) => sum + line.finalLineTotal, 0)
    ),
    stacked: stackedConfig
      ? {
          id: stackedConfig.id || null,
          active: Boolean(activeTier) && !stackedDisabledByCoupon,
          configured: Boolean(stackedConfig.active && stackedConfig.tiers.length),
          eligibleQuantity,
          percentage: activeTier?.percentage || 0,
          quantity: activeTier?.quantity || 0,
          eligibleSubtotal: stackedEligibleSubtotal,
          discountAmount: stackedDiscountAmount,
          disabledByCoupon: stackedDisabledByCoupon,
          allowCouponStacking: stackedConfig.allowCouponStacking !== false,
          allowDiscountStacking: stackedConfig.allowDiscountStacking !== false,
          nextTier: nextTier
            ? {
                quantity: nextTier.quantity,
                percentage: nextTier.percentage,
                missingQuantity: Math.max(
                  0,
                  nextTier.quantity - Math.max(0, eligibleQuantity)
                ),
              }
            : null,
        }
      : null,
  };
}

export function calculateCartPricing({
  lines = [],
  stackedDiscount = null,
  coupon = null,
} = {}) {
  const normalizedLines = (Array.isArray(lines) ? lines : [])
    .map((line, index) => normalizeLine(line, index))
    .filter(Boolean);

  const baseline = buildScenario({
    lines: normalizedLines,
    stackedDiscount,
    coupon: null,
  });

  const normalizedCoupon = normalizeCoupon(coupon);
  if (!normalizedCoupon) {
    return baseline;
  }

  const couponScenario = buildScenario({
    lines: normalizedLines,
    stackedDiscount,
    coupon: normalizedCoupon,
  });

  if (!couponScenario.coupon?.applicable || couponScenario.coupon.discountAmount <= 0) {
    return {
      ...baseline,
      coupon: couponScenario.coupon,
    };
  }

  return couponScenario;
}

export function buildNextStackedTierMessage(stackedSummary) {
  if (
    stackedSummary?.disabledByCoupon === true ||
    !stackedSummary?.nextTier ||
    stackedSummary.nextTier.missingQuantity <= 0
  ) {
    return "";
  }
  const missing = stackedSummary.nextTier.missingQuantity;
  return `Sepete ${missing} uygun ürün daha ekleyin ve %${stackedSummary.nextTier.percentage} indirim kazanın.`;
}
