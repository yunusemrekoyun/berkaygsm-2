const BASE_PROFILES = [
  {
    key: "regular",
    customerNameMaxChars: 28,
    customerNameMaxLines: 2,
    addressMaxChars: 34,
    addressMaxLines: 4,
    noteMaxChars: 36,
    noteMaxLines: 6,
    itemNameMaxChars: 28,
    itemNameMaxLines: 2,
    itemMetaMaxChars: 32,
    itemMaxSelectionLines: 2,
    itemLineBudget: 14,
    html: {
      sheetPadding: "4.5mm",
      sheetGap: "2.4mm",
      sectionPaddingY: "2.2mm",
      sectionPaddingX: "2.5mm",
      sectionTitleFontSize: "2.3mm",
      sectionTitleMarginBottom: "1.2mm",
      customerNameFontSize: "3.45mm",
      customerNameGap: "0.4mm",
      customerPhoneFontSize: "2.95mm",
      addressFontSize: "2.82mm",
      addressLineHeight: "1.28",
      itemsGap: "1.7mm",
      itemRowGap: "2mm",
      itemRowPaddingBottom: "1.5mm",
      itemNameFontSize: "2.9mm",
      itemNameLineHeight: "1.22",
      itemMetaGap: "0.45mm",
      itemMetaFontSize: "2.45mm",
      itemSubFontSize: "2.35mm",
      itemSubLineHeight: "1.2",
      itemTotalFontSize: "2.7mm",
      totalsGap: "0.85mm",
      totalFontSize: "2.7mm",
      totalStrongFontSize: "3.15mm",
      noteFontSize: "2.55mm",
      noteLineHeight: "1.24",
      noteMaxHeight: "12.8mm",
    },
    preview: {
      sectionSpacing: "space-y-2.5",
      sectionPadding: "p-3",
      titleText: "text-[10px]",
      customerNameText: "text-[15px] leading-5",
      customerPhoneText: "text-[13px]",
      addressText: "text-[12.5px] leading-[1.35]",
      itemsSpacing: "space-y-2.5",
      itemNameText: "text-[13px] leading-[1.3]",
      itemMetaText: "text-[11px] leading-[1.3]",
      itemTotalText: "text-[13px]",
      totalsText: "text-[12.5px]",
      totalStrongText: "text-[15px]",
      noteText: "text-[12px] leading-[1.35]",
    },
    tspl: {
      headerTitleMul: 2,
      receiverHeight: 118,
      receiverNameLineHeight: 24,
      addressHeight: 164,
      addressLineHeight: 22,
      itemsHeight: 300,
      itemNameLineHeight: 22,
      itemMetaLineHeight: 20,
      itemGap: 4,
      totalsRowHeight: 24,
      noteLineHeight: 20,
    },
  },
  {
    key: "compact",
    customerNameMaxChars: 32,
    customerNameMaxLines: 2,
    addressMaxChars: 38,
    addressMaxLines: 5,
    noteMaxChars: 40,
    noteMaxLines: 6,
    itemNameMaxChars: 32,
    itemNameMaxLines: 2,
    itemMetaMaxChars: 36,
    itemMaxSelectionLines: 2,
    itemLineBudget: 16,
    html: {
      sheetPadding: "4mm",
      sheetGap: "2mm",
      sectionPaddingY: "1.9mm",
      sectionPaddingX: "2.2mm",
      sectionTitleFontSize: "2.1mm",
      sectionTitleMarginBottom: "0.9mm",
      customerNameFontSize: "3.1mm",
      customerNameGap: "0.3mm",
      customerPhoneFontSize: "2.7mm",
      addressFontSize: "2.55mm",
      addressLineHeight: "1.24",
      itemsGap: "1.35mm",
      itemRowGap: "1.6mm",
      itemRowPaddingBottom: "1.1mm",
      itemNameFontSize: "2.65mm",
      itemNameLineHeight: "1.18",
      itemMetaGap: "0.3mm",
      itemMetaFontSize: "2.25mm",
      itemSubFontSize: "2.18mm",
      itemSubLineHeight: "1.16",
      itemTotalFontSize: "2.45mm",
      totalsGap: "0.65mm",
      totalFontSize: "2.45mm",
      totalStrongFontSize: "2.9mm",
      noteFontSize: "2.3mm",
      noteLineHeight: "1.18",
      noteMaxHeight: "11.8mm",
    },
    preview: {
      sectionSpacing: "space-y-2",
      sectionPadding: "p-2.5",
      titleText: "text-[9px]",
      customerNameText: "text-[14px] leading-[1.25]",
      customerPhoneText: "text-[12px]",
      addressText: "text-[11.5px] leading-[1.28]",
      itemsSpacing: "space-y-2",
      itemNameText: "text-[12px] leading-[1.22]",
      itemMetaText: "text-[10px] leading-[1.22]",
      itemTotalText: "text-[12px]",
      totalsText: "text-[11.5px]",
      totalStrongText: "text-[14px]",
      noteText: "text-[11px] leading-[1.28]",
    },
    tspl: {
      headerTitleMul: 2,
      receiverHeight: 106,
      receiverNameLineHeight: 21,
      addressHeight: 146,
      addressLineHeight: 20,
      itemsHeight: 334,
      itemNameLineHeight: 19,
      itemMetaLineHeight: 17,
      itemGap: 3,
      totalsRowHeight: 22,
      noteLineHeight: 18,
    },
  },
  {
    key: "tight",
    customerNameMaxChars: 36,
    customerNameMaxLines: 2,
    addressMaxChars: 42,
    addressMaxLines: 5,
    noteMaxChars: 44,
    noteMaxLines: 5,
    itemNameMaxChars: 36,
    itemNameMaxLines: 2,
    itemMetaMaxChars: 40,
    itemMaxSelectionLines: 1,
    itemLineBudget: 18,
    html: {
      sheetPadding: "3.6mm",
      sheetGap: "1.7mm",
      sectionPaddingY: "1.7mm",
      sectionPaddingX: "2mm",
      sectionTitleFontSize: "1.95mm",
      sectionTitleMarginBottom: "0.8mm",
      customerNameFontSize: "2.85mm",
      customerNameGap: "0.25mm",
      customerPhoneFontSize: "2.45mm",
      addressFontSize: "2.35mm",
      addressLineHeight: "1.2",
      itemsGap: "1.1mm",
      itemRowGap: "1.4mm",
      itemRowPaddingBottom: "0.9mm",
      itemNameFontSize: "2.4mm",
      itemNameLineHeight: "1.14",
      itemMetaGap: "0.25mm",
      itemMetaFontSize: "2.05mm",
      itemSubFontSize: "1.98mm",
      itemSubLineHeight: "1.12",
      itemTotalFontSize: "2.18mm",
      totalsGap: "0.55mm",
      totalFontSize: "2.18mm",
      totalStrongFontSize: "2.6mm",
      noteFontSize: "2.05mm",
      noteLineHeight: "1.14",
      noteMaxHeight: "10.8mm",
    },
    preview: {
      sectionSpacing: "space-y-1.5",
      sectionPadding: "p-2.5",
      titleText: "text-[8.5px]",
      customerNameText: "text-[13px] leading-[1.18]",
      customerPhoneText: "text-[11px]",
      addressText: "text-[10.5px] leading-[1.18]",
      itemsSpacing: "space-y-1.5",
      itemNameText: "text-[11px] leading-[1.16]",
      itemMetaText: "text-[9.5px] leading-[1.16]",
      itemTotalText: "text-[11px]",
      totalsText: "text-[10.5px]",
      totalStrongText: "text-[13px]",
      noteText: "text-[10px] leading-[1.2]",
    },
    tspl: {
      headerTitleMul: 1,
      receiverHeight: 94,
      receiverNameLineHeight: 19,
      addressHeight: 126,
      addressLineHeight: 18,
      itemsHeight: 366,
      itemNameLineHeight: 17,
      itemMetaLineHeight: 15,
      itemGap: 2,
      totalsRowHeight: 20,
      noteLineHeight: 16,
    },
  },
  {
    key: "micro",
    customerNameMaxChars: 40,
    customerNameMaxLines: 2,
    addressMaxChars: 46,
    addressMaxLines: 5,
    noteMaxChars: 48,
    noteMaxLines: 5,
    itemNameMaxChars: 40,
    itemNameMaxLines: 2,
    itemMetaMaxChars: 44,
    itemMaxSelectionLines: 1,
    itemLineBudget: 20,
    html: {
      sheetPadding: "3.1mm",
      sheetGap: "1.5mm",
      sectionPaddingY: "1.5mm",
      sectionPaddingX: "1.8mm",
      sectionTitleFontSize: "1.8mm",
      sectionTitleMarginBottom: "0.7mm",
      customerNameFontSize: "2.65mm",
      customerNameGap: "0.2mm",
      customerPhoneFontSize: "2.25mm",
      addressFontSize: "2.18mm",
      addressLineHeight: "1.16",
      itemsGap: "0.9mm",
      itemRowGap: "1.2mm",
      itemRowPaddingBottom: "0.7mm",
      itemNameFontSize: "2.2mm",
      itemNameLineHeight: "1.12",
      itemMetaGap: "0.2mm",
      itemMetaFontSize: "1.92mm",
      itemSubFontSize: "1.86mm",
      itemSubLineHeight: "1.08",
      itemTotalFontSize: "2.05mm",
      totalsGap: "0.45mm",
      totalFontSize: "2.05mm",
      totalStrongFontSize: "2.4mm",
      noteFontSize: "1.92mm",
      noteLineHeight: "1.12",
      noteMaxHeight: "10mm",
    },
    preview: {
      sectionSpacing: "space-y-1.5",
      sectionPadding: "p-2",
      titleText: "text-[8px]",
      customerNameText: "text-[12px] leading-[1.14]",
      customerPhoneText: "text-[10.5px]",
      addressText: "text-[10px] leading-[1.14]",
      itemsSpacing: "space-y-1.5",
      itemNameText: "text-[10.5px] leading-[1.12]",
      itemMetaText: "text-[9px] leading-[1.12]",
      itemTotalText: "text-[10.5px]",
      totalsText: "text-[10px]",
      totalStrongText: "text-[12px]",
      noteText: "text-[9.5px] leading-[1.16]",
    },
    tspl: {
      headerTitleMul: 1,
      receiverHeight: 88,
      receiverNameLineHeight: 18,
      addressHeight: 116,
      addressLineHeight: 17,
      itemsHeight: 388,
      itemNameLineHeight: 16,
      itemMetaLineHeight: 14,
      itemGap: 2,
      totalsRowHeight: 19,
      noteLineHeight: 15,
    },
  },
];

function normalizePrintableText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function clampLineWithEllipsis(line, maxChars) {
  const normalized = normalizePrintableText(line);
  if (!normalized) return "";
  const safeMax = Math.max(1, Number(maxChars || 0) || 1);
  if (normalized.endsWith("...")) return normalized;
  if (normalized.length <= Math.max(0, safeMax - 3)) {
    return `${normalized}...`;
  }
  const sliceMax = Math.max(1, safeMax - 3);
  return `${normalized.slice(0, sliceMax).trimEnd()}...`;
}

function wrapPrintableText(value, maxChars, maxLines) {
  const sourceLines = String(value ?? "")
    .split(/\r?\n/)
    .map(normalizePrintableText)
    .filter(Boolean);

  if (!sourceLines.length) return { lines: [], truncated: false };

  const wrapped = [];
  let truncated = false;

  outer: for (const sourceLine of sourceLines) {
    const words = sourceLine.split(" ");
    let current = "";

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length <= maxChars) {
        current = candidate;
        continue;
      }

      if (current) {
        if (wrapped.length >= maxLines) {
          truncated = true;
          break outer;
        }
        wrapped.push(current);
      }

      if (word.length <= maxChars) {
        current = word;
        continue;
      }

      let remaining = word;
      while (remaining.length > maxChars) {
        if (wrapped.length >= maxLines) {
          truncated = true;
          break outer;
        }
        wrapped.push(remaining.slice(0, maxChars));
        remaining = remaining.slice(maxChars);
      }
      current = remaining;
    }

    if (current) {
      if (wrapped.length >= maxLines) {
        truncated = true;
        break;
      }
      wrapped.push(current);
    }
  }

  if (wrapped.length > maxLines) {
    wrapped.length = maxLines;
    truncated = true;
  }

  if (truncated && wrapped.length) {
    wrapped[wrapped.length - 1] = clampLineWithEllipsis(
      wrapped[wrapped.length - 1],
      maxChars
    );
  }

  return {
    lines: wrapped.filter(Boolean),
    truncated,
  };
}

function buildLineCost(item, profile) {
  const lineCount =
    (Array.isArray(item.nameLines) ? item.nameLines.length : 0) +
    (Array.isArray(item.metaLines) ? item.metaLines.length : 0);
  return lineCount + 1;
}

function buildOverflowItem(hiddenItemCount, hiddenQty, profile) {
  const name = wrapPrintableText(
    `+${hiddenItemCount} diger urun`,
    profile.itemNameMaxChars,
    1
  ).lines;
  const meta = wrapPrintableText(
    `Toplam ${hiddenQty} adet`,
    profile.itemMetaMaxChars,
    1
  ).lines;
  return {
    id: `overflow-${hiddenItemCount}-${hiddenQty}`,
    name: `+${hiddenItemCount} diger urun`,
    qty: hiddenQty,
    lineTotalLabel: "",
    nameLines: name,
    metaLines: meta,
    isOverflowSummary: true,
  };
}

function buildItemLayout(item, profile) {
  const nameWrapped = wrapPrintableText(
    item?.name || "",
    profile.itemNameMaxChars,
    profile.itemNameMaxLines
  );

  const metaInputs = [];
  const baseMeta = [item?.qtyLabel, item?.variantSummary].filter(Boolean).join(" • ");
  if (baseMeta) metaInputs.push(baseMeta);

  const rawSelections = Array.isArray(item?.selectionLines)
    ? item.selectionLines.filter(Boolean)
    : [];
  const visibleSelections = rawSelections.slice(0, profile.itemMaxSelectionLines);
  visibleSelections.forEach((line) => metaInputs.push(line));

  const hiddenSelections = Math.max(0, rawSelections.length - visibleSelections.length);
  if (hiddenSelections > 0) {
    metaInputs.push(`+${hiddenSelections} secim daha`);
  }

  const metaLines = [];
  let truncatedMeta = hiddenSelections > 0;

  metaInputs.forEach((line) => {
    const wrapped = wrapPrintableText(line, profile.itemMetaMaxChars, 1);
    if (wrapped.truncated) truncatedMeta = true;
    metaLines.push(...wrapped.lines);
  });

  return {
    ...item,
    nameLines: nameWrapped.lines,
    metaLines,
    truncated:
      nameWrapped.truncated ||
      truncatedMeta ||
      hiddenSelections > 0,
    hiddenSelections,
  };
}

function fitItemsIntoProfile(rawItems, profile) {
  const normalizedItems = Array.isArray(rawItems)
    ? rawItems.map((item) => buildItemLayout(item, profile))
    : [];
  const budget = Math.max(4, Number(profile.itemLineBudget || 0) || 0);
  const visible = [];
  let used = 0;
  let hiddenItemCount = 0;
  let hiddenQty = 0;
  let firstHiddenIndex = normalizedItems.length;
  let truncatedItemCount = 0;

  for (let index = 0; index < normalizedItems.length; index += 1) {
    const item = normalizedItems[index];
    const cost = buildLineCost(item, profile);

    if (item.truncated) truncatedItemCount += 1;

    if (used + cost <= budget) {
      visible.push({ ...item, _cost: cost });
      used += cost;
      continue;
    }

    firstHiddenIndex = index;
    hiddenItemCount = normalizedItems.length - index;
    hiddenQty = normalizedItems
      .slice(index)
      .reduce((sum, current) => sum + (Number(current.qty || 0) || 1), 0);
    break;
  }

  if (hiddenItemCount > 0) {
    let overflowItem = buildOverflowItem(hiddenItemCount, hiddenQty, profile);
    let overflowCost = buildLineCost(overflowItem, profile);

    while (visible.length && used + overflowCost > budget) {
      const removed = visible.pop();
      used -= Number(removed?._cost || 0);
      hiddenItemCount += 1;
      hiddenQty += Number(removed?.qty || 0) || 1;
      overflowItem = buildOverflowItem(hiddenItemCount, hiddenQty, profile);
      overflowCost = buildLineCost(overflowItem, profile);
    }

    if (used + overflowCost <= budget) {
      visible.push({
        ...overflowItem,
        _cost: overflowCost,
      });
    } else if (!visible.length) {
      visible.push({
        ...overflowItem,
        _cost: overflowCost,
      });
    }
  }

  return {
    items: visible.map(({ _cost, ...item }) => item),
    hiddenItemCount,
    hiddenQty,
    hiddenItemStartIndex:
      firstHiddenIndex < normalizedItems.length ? firstHiddenIndex : null,
    truncatedItemCount,
  };
}

function countTruncation(flags = []) {
  return flags.reduce((sum, value) => sum + (value ? 1 : 0), 0);
}

function buildLayoutForProfile(input, profile) {
  const customerWrapped = wrapPrintableText(
    input?.customerName || "-",
    profile.customerNameMaxChars,
    profile.customerNameMaxLines
  );

  const addressWrapped = wrapPrintableText(
    Array.isArray(input?.addressLines)
      ? input.addressLines.filter(Boolean).join("\n")
      : "",
    profile.addressMaxChars,
    profile.addressMaxLines
  );

  const noteWrapped = wrapPrintableText(
    input?.note || "",
    profile.noteMaxChars,
    profile.noteMaxLines
  );

  const itemLayout = fitItemsIntoProfile(input?.items || [], profile);
  const truncationScore = countTruncation([
    customerWrapped.truncated,
    addressWrapped.truncated,
    noteWrapped.truncated,
  ]);
  const score =
    itemLayout.hiddenItemCount * 100 +
    truncationScore * 10 +
    itemLayout.truncatedItemCount;

  return {
    profile,
    score,
    customerNameLines: customerWrapped.lines.length
      ? customerWrapped.lines
      : ["-"],
    addressLines: addressWrapped.lines,
    noteLines: noteWrapped.lines,
    note: noteWrapped.lines.join("\n"),
    items: itemLayout.items,
    hiddenItemCount: itemLayout.hiddenItemCount,
    hiddenQty: itemLayout.hiddenQty,
    metrics: {
      customerTruncated: customerWrapped.truncated,
      addressTruncated: addressWrapped.truncated,
      noteTruncated: noteWrapped.truncated,
      truncatedItemCount: itemLayout.truncatedItemCount,
    },
  };
}

export const ORDER_PRINT_LAYOUT_PROFILES = BASE_PROFILES.map((profile) => ({
  ...profile,
}));

export function getOrderPrintLayoutProfile(profileKey = "regular") {
  return (
    ORDER_PRINT_LAYOUT_PROFILES.find((profile) => profile.key === profileKey) ||
    ORDER_PRINT_LAYOUT_PROFILES[0]
  );
}

export function wrapPrintableTextLines(value, maxChars, maxLines) {
  return wrapPrintableText(value, maxChars, maxLines).lines;
}

export function buildAdaptiveOrderPrintLayout(input = {}) {
  let best = null;

  ORDER_PRINT_LAYOUT_PROFILES.forEach((profile) => {
    const candidate = buildLayoutForProfile(input, profile);
    if (!best || candidate.score < best.score) {
      best = candidate;
    }
    if (candidate.score === 0 && !best?.finalized) {
      best = { ...candidate, finalized: true };
    }
  });

  const selected = best || buildLayoutForProfile(input, ORDER_PRINT_LAYOUT_PROFILES[0]);
  return {
    key: selected.profile.key,
    profile: selected.profile,
    customerNameLines: selected.customerNameLines,
    addressLines: selected.addressLines,
    note: selected.note,
    noteLines: selected.noteLines,
    items: selected.items,
    hiddenItemCount: selected.hiddenItemCount,
    hiddenQty: selected.hiddenQty,
    metrics: selected.metrics,
  };
}
