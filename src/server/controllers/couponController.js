import mongoose from "mongoose";
import Coupon from "../models/Coupon.js";
import CouponAssignment from "../models/CouponAssignment.js";
import CouponRedemption from "../models/CouponRedemption.js";
import User from "../models/User.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import ProductSet from "../models/Set.js";
import Category from "../models/Category.js";
import {
  COUPON_TEMPLATES,
  evaluateCouponForOrderContext,
  isCouponActiveNow,
  isValidManualCouponCode,
  issueCouponAssignments,
  normalizeCouponCodeInput,
  parseIstanbulDateInput,
  validateDateRange,
} from "../utils/couponEngine.js";

const AUDIENCE_VALUES = ["public", "personal"];
const ASSIGNMENT_VALUES = ["everyone", "manual"];
const SUCCESS_ORDER_STATUSES = ["paid", "shipped", "completed"];

async function ensureCouponCodeIndex() {
  const indexes = await Coupon.collection.indexes();
  const codeIndexes = indexes.filter(
    (index) =>
      index?.key &&
      Object.keys(index.key).length === 1 &&
      Number(index.key.code) === 1
  );
  const desiredIndex = codeIndexes.find(
    (index) =>
      index.unique === true &&
      index.partialFilterExpression?.code?.$type === "string"
  );

  for (const index of codeIndexes) {
    if (desiredIndex && index.name === desiredIndex.name) continue;
    await Coupon.collection.dropIndex(index.name);
  }

  if (!desiredIndex) {
    await Coupon.collection.createIndex(
      { code: 1 },
      {
        name: "code_1",
        unique: true,
        partialFilterExpression: { code: { $type: "string" } },
      }
    );
  }
}

function parseBooleanInput(value, field = "active") {
  if (value === undefined) return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
  }
  throw new Error(`${field} alanı true/false olmalı`);
}

function parseEnumInput(value, allowed, field) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (!allowed.includes(normalized)) {
    throw new Error(`${field} alanı geçersiz`);
  }
  return normalized;
}

function parseRequiredPercent(value, fallback) {
  const next = value !== undefined ? value : fallback;
  const parsed = Number(next);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100) {
    throw new Error("Yüzde 1-100 arasında olmalı");
  }
  return Math.round(parsed * 100) / 100;
}

function parseMinSubtotal(value, fallback = 0) {
  const next = value !== undefined ? value : fallback;
  const parsed = Number(next ?? 0);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Minimum sepet tutarı 0 veya daha büyük olmalı");
  }
  return Math.round(parsed * 100) / 100;
}

function parseNullablePositiveInt(value, field, { min = 1 } = {}) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min) {
    throw new Error(`${field} alanı en az ${min} olmalı`);
  }
  return Math.floor(parsed);
}

function parseCodeInput(value, fallback = undefined) {
  if (value === undefined) return fallback;
  const code = normalizeCouponCodeInput(value);
  return code || undefined;
}

function parseTargetIds(raw, field) {
  const source = Array.isArray(raw) ? raw : [];
  const deduped = Array.from(
    new Set(
      source
        .map((id) => id?.toString?.() || String(id || ""))
        .map((id) => id.trim())
        .filter(Boolean)
    )
  );
  const invalid = deduped.find((id) => !mongoose.Types.ObjectId.isValid(id));
  if (invalid) {
    throw new Error(`${field} içinde geçersiz id var`);
  }
  return deduped;
}

function parseManualUsers(raw, fallback = []) {
  if (raw === undefined) return parseTargetIds(fallback, "manualUsers");
  return parseTargetIds(raw, "manualUsers");
}

function parseTargets(rawTargets = {}, fallback = {}) {
  const source = rawTargets && typeof rawTargets === "object" ? rawTargets : {};
  const base = fallback && typeof fallback === "object" ? fallback : {};
  return {
    products: parseTargetIds(
      source.products !== undefined ? source.products : base.products || [],
      "targets.products"
    ),
    sets: parseTargetIds(
      source.sets !== undefined ? source.sets : base.sets || [],
      "targets.sets"
    ),
    categories: parseTargetIds(
      source.categories !== undefined
        ? source.categories
        : base.categories || [],
      "targets.categories"
    ),
  };
}

function buildCouponPayload(input = {}, existing = null) {
  const template = parseEnumInput(
    input.template !== undefined
      ? input.template
      : existing?.template || "manual",
    COUPON_TEMPLATES,
    "template"
  );

  let audience = parseEnumInput(
    input.audience !== undefined
      ? input.audience
      : existing?.audience || "public",
    AUDIENCE_VALUES,
    "audience"
  );

  const description =
    input.description !== undefined
      ? String(input.description || "").trim()
      : existing?.description || "";

  const percentage = parseRequiredPercent(input.percentage, existing?.percentage);
  const minSubtotal = parseMinSubtotal(input.minSubtotal, existing?.minSubtotal || 0);
  const active =
    parseBooleanInput(input.active, "active") ??
    (existing?.active !== undefined ? Boolean(existing.active) : true);

  const startsAt =
    input.startsAt !== undefined
      ? parseIstanbulDateInput(input.startsAt, "startsAt")
      : existing?.startsAt ?? null;
  const endsAt =
    input.endsAt !== undefined
      ? parseIstanbulDateInput(input.endsAt, "endsAt")
      : existing?.endsAt ?? null;
  validateDateRange(startsAt, endsAt);

  const parsedMaxTotalUses = parseNullablePositiveInt(
    input.maxTotalUses,
    "maxTotalUses"
  );
  const maxTotalUses =
    parsedMaxTotalUses === undefined
      ? existing?.maxTotalUses ?? null
      : parsedMaxTotalUses;
  const maxUsesPerUser = 1;

  let firstPurchaseOnly =
    parseBooleanInput(input.firstPurchaseOnly, "firstPurchaseOnly") ??
    (existing?.firstPurchaseOnly ?? false);
  const parsedWinbackDays = parseNullablePositiveInt(
    input.winbackDays,
    "winbackDays"
  );
  let winbackDays =
    parsedWinbackDays === undefined
      ? existing?.winbackDays ?? null
      : parsedWinbackDays;

  let assignmentMode = parseEnumInput(
    input.assignmentMode !== undefined
      ? input.assignmentMode
      : existing?.assignmentMode || "everyone",
    ASSIGNMENT_VALUES,
    "assignmentMode"
  );
  let manualUsers = parseManualUsers(input.manualUsers, existing?.manualUsers || []);
  const targets = parseTargets(input.targets, existing?.targets || {});

  let autoAssignNewUsers =
    parseBooleanInput(input.autoAssignNewUsers, "autoAssignNewUsers") ??
    (existing?.autoAssignNewUsers ?? false);

  let code = parseCodeInput(input.code, existing?.code ?? undefined);

  if (template === "first_purchase") {
    audience = "personal";
    assignmentMode = "everyone";
    autoAssignNewUsers = true;
    firstPurchaseOnly = true;
    winbackDays = null;
    manualUsers = [];
    code = undefined;
  }

  if (template === "winback") {
    audience = "personal";
    autoAssignNewUsers = false;
    if (!winbackDays || winbackDays < 1) {
      throw new Error("Geri kazanım kuponu için winbackDays zorunlu");
    }
  }

  if (template === "category_specific" && !targets.categories.length) {
    throw new Error("Kategori özel kupon için en az bir kategori seçmelisiniz");
  }

  if (audience === "public") {
    assignmentMode = "everyone";
    autoAssignNewUsers = false;
    manualUsers = [];
    firstPurchaseOnly = Boolean(firstPurchaseOnly && template === "first_purchase");
    winbackDays = template === "winback" ? winbackDays : null;

    if (!code) {
      throw new Error("Kupon kodu gerekli");
    }
    if (!isValidManualCouponCode(code)) {
      throw new Error(
        "Kupon kodu yalnızca A-Z ve 2-9 karakterlerinden oluşmalı"
      );
    }
  } else {
    code = undefined;
    if (assignmentMode === "manual" && !manualUsers.length) {
      throw new Error("Manuel atama için en az bir kullanıcı seçmelisiniz");
    }
    if (template !== "winback") {
      autoAssignNewUsers = assignmentMode === "everyone";
    }
  }

  return {
    document: {
      code,
      template,
      audience,
      assignmentMode,
      autoAssignNewUsers,
      manualUsers,
      description,
      percentage,
      minSubtotal,
      maxTotalUses,
      maxUsesPerUser,
      firstPurchaseOnly,
      winbackDays,
      targets,
      active,
      startsAt,
      endsAt,
    },
    meta: {
      assignmentMode,
      manualUsers,
    },
  };
}

async function ensureUniquePublicCode(code, exceptId = null) {
  if (typeof code !== "string" || !code.trim()) return;
  const query = exceptId ? { code, _id: { $ne: exceptId } } : { code };
  const exists = await Coupon.findOne(query).lean();
  if (exists) {
    throw new Error("Kupon kodu zaten mevcut");
  }
}

async function resolveBaseUsersForCoupon(coupon, manualUserIds = []) {
  if (!coupon || coupon.audience !== "personal") return [];

  if (coupon.template === "first_purchase") {
    // İlk alışveriş kuponu sadece yeni kayıt anında atanır.
    return [];
  }

  if (coupon.assignmentMode === "manual") {
    return parseTargetIds(manualUserIds, "manualUsers");
  }

  const users = await User.find(
    { role: "user", isDeleted: { $ne: true } },
    { _id: 1 }
  ).lean();
  return users.map((user) => String(user._id));
}

async function applyWinbackFilter(userIds = [], winbackDays = null) {
  const days = Number(winbackDays || 0);
  if (!days || !Array.isArray(userIds) || userIds.length === 0) {
    return userIds;
  }

  const validObjectIds = userIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  if (!validObjectIds.length) return [];

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const aggregate = await Order.aggregate([
    {
      $match: {
        user: { $in: validObjectIds },
        status: { $in: SUCCESS_ORDER_STATUSES },
      },
    },
    { $group: { _id: "$user", lastOrderAt: { $max: "$createdAt" } } },
    { $match: { lastOrderAt: { $lte: cutoff } } },
    { $project: { _id: 1 } },
  ]);

  const eligibleSet = new Set(aggregate.map((entry) => String(entry._id)));
  return userIds.filter((id) => eligibleSet.has(String(id)));
}

async function syncCouponAssignments(coupon, manualUserIds = [], assignedBy = null) {
  if (!coupon || coupon.audience !== "personal") {
    return { total: 0, created: 0, existing: 0, eligible: 0 };
  }

  const baseUserIds = await resolveBaseUsersForCoupon(coupon, manualUserIds);
  const eligibleUserIds =
    coupon.template === "winback"
      ? await applyWinbackFilter(baseUserIds, coupon.winbackDays)
      : baseUserIds;

  if (!eligibleUserIds.length) {
    return {
      total: baseUserIds.length,
      created: 0,
      existing: 0,
      eligible: 0,
    };
  }

  const result = await issueCouponAssignments({
    coupon,
    userIds: eligibleUserIds,
    assignedBy,
    source: coupon.assignmentMode === "manual" ? "template_manual" : "template_auto",
  });

  return { ...result, eligible: eligibleUserIds.length };
}

function buildCouponStats(coupons = [], assignmentAgg = [], redemptionAgg = []) {
  const assignmentMap = new Map();
  for (const row of assignmentAgg) {
    assignmentMap.set(String(row._id), {
      total: Number(row.total || 0),
      used: Number(row.used || 0),
    });
  }

  const redemptionMap = new Map();
  for (const row of redemptionAgg) {
    redemptionMap.set(String(row._id), Number(row.users || 0));
  }

  return coupons.map((coupon) => {
    const id = coupon._id?.toString?.() || String(coupon._id || "");
    const assignment = assignmentMap.get(id) || { total: 0, used: 0 };
    const redeemedUsers = redemptionMap.get(id) || 0;
    return shapeCoupon(coupon, {
      assignmentTotal: assignment.total,
      assignmentUsed: assignment.used,
      redeemedUsers,
    });
  });
}

function normalizeTargetsForView(coupon) {
  const rawTargets =
    coupon?.targets && typeof coupon.targets === "object" ? coupon.targets : {};
  const normalizeIdList = (list = []) =>
    Array.from(
      new Set(
        (Array.isArray(list) ? list : [])
          .map((id) => id?.toString?.() || String(id || ""))
          .map((id) => id.trim())
          .filter(Boolean)
      )
    );

  return {
    products: normalizeIdList(rawTargets.products),
    sets: normalizeIdList(rawTargets.sets),
    categories: normalizeIdList(rawTargets.categories),
  };
}

function hasTargetScope(targets) {
  return Boolean(
    (targets?.products?.length || 0) +
      (targets?.sets?.length || 0) +
      (targets?.categories?.length || 0)
  );
}

function pickDisplayName(doc, fallback = "İsimsiz") {
  if (!doc) return fallback;
  const trName = doc.translations?.tr?.name;
  if (typeof trName === "string" && trName.trim()) return trName.trim();
  if (typeof doc.name === "string" && doc.name.trim()) return doc.name.trim();
  return fallback;
}

async function buildCouponTargetCatalog(coupons = []) {
  const targetCoupons = Array.isArray(coupons) ? coupons : [];
  const productIds = new Set();
  const setIds = new Set();
  const categoryIds = new Set();

  for (const coupon of targetCoupons) {
    const targets = normalizeTargetsForView(coupon);
    for (const id of targets.products) {
      if (mongoose.Types.ObjectId.isValid(id)) productIds.add(id);
    }
    for (const id of targets.sets) {
      if (mongoose.Types.ObjectId.isValid(id)) setIds.add(id);
    }
    for (const id of targets.categories) {
      if (mongoose.Types.ObjectId.isValid(id)) categoryIds.add(id);
    }
  }

  const [products, sets, categories] = await Promise.all([
    productIds.size
      ? Product.find(
          { _id: { $in: Array.from(productIds) } },
          { name: 1, slug: 1, translations: 1, images: 1, price: 1 }
        ).lean()
      : [],
    setIds.size
      ? ProductSet.find({ _id: { $in: Array.from(setIds) } }, {
          name: 1,
          slug: 1,
          translations: 1,
          images: 1,
          price: 1,
        }).lean()
      : [],
    categoryIds.size
      ? Category.find(
          { _id: { $in: Array.from(categoryIds) } },
          { name: 1, slug: 1, translations: 1 }
        ).lean()
      : [],
  ]);

  const productMap = new Map();
  for (const product of products) {
    productMap.set(String(product._id), {
      id: String(product._id),
      name: pickDisplayName(product, "Ürün"),
      slug: product.slug || null,
      image: product.images?.[0]?.url
        ? { url: product.images[0].url }
        : null,
      price: Number(product.price || 0),
      type: "product",
    });
  }

  const setMap = new Map();
  for (const setDoc of sets) {
    setMap.set(String(setDoc._id), {
      id: String(setDoc._id),
      name: pickDisplayName(setDoc, "Set"),
      slug: setDoc.slug || null,
      image: setDoc.images?.[0]?.url
        ? { url: setDoc.images[0].url }
        : null,
      price: Number(setDoc.price || 0),
      type: "set",
    });
  }

  const categoryMap = new Map();
  for (const category of categories) {
    categoryMap.set(String(category._id), {
      id: String(category._id),
      name: pickDisplayName(category, "Kategori"),
      slug: category.slug || null,
      type: "category",
    });
  }

  return {
    products: productMap,
    sets: setMap,
    categories: categoryMap,
  };
}

function computeCouponAvailability({
  coupon,
  assignment = null,
  userUses = 0,
  now = new Date(),
}) {
  if (!coupon) {
    return {
      canUse: false,
      status: "invalid",
      reason: "invalid",
    };
  }

  if (!coupon.active || (assignment && assignment.active === false)) {
    return {
      canUse: false,
      status: "inactive",
      reason: "inactive",
    };
  }

  if (coupon.startsAt && new Date(coupon.startsAt).getTime() > now.getTime()) {
    return {
      canUse: false,
      status: "upcoming",
      reason: "upcoming",
    };
  }

  if (coupon.endsAt && new Date(coupon.endsAt).getTime() < now.getTime()) {
    return {
      canUse: false,
      status: "expired",
      reason: "expired",
    };
  }

  const perUserLimit = Math.max(1, Number(coupon.maxUsesPerUser || 1));
  if (Number(userUses || 0) >= perUserLimit) {
    return {
      canUse: false,
      status: "used_up",
      reason: "perUserLimit",
    };
  }

  const maxTotalUses = Number(coupon.maxTotalUses || 0);
  if (maxTotalUses > 0 && Number(coupon.totalUses || 0) >= maxTotalUses) {
    return {
      canUse: false,
      status: "total_limit",
      reason: "totalLimit",
    };
  }

  return {
    canUse: isCouponActiveNow(coupon, now),
    status: "active",
    reason: null,
  };
}

function shapeUserCoupon({
  coupon,
  userUses = 0,
  assignment = null,
  now = new Date(),
  targetCatalog = null,
}) {
  if (!coupon) return null;
  const perUserLimit = Math.max(1, Number(coupon.maxUsesPerUser || 1));
  const maxTotalUses =
    coupon.maxTotalUses === null || coupon.maxTotalUses === undefined
      ? null
      : Number(coupon.maxTotalUses || 0);
  const availability = computeCouponAvailability({
    coupon,
    assignment,
    userUses,
    now,
  });
  const targets = normalizeTargetsForView(coupon);
  const scoped = hasTargetScope(targets);
  const targetItems = {
    products: targets.products
      .map((id) => targetCatalog?.products?.get(id) || null)
      .filter(Boolean),
    sets: targets.sets
      .map((id) => targetCatalog?.sets?.get(id) || null)
      .filter(Boolean),
    categories: targets.categories
      .map((id) => targetCatalog?.categories?.get(id) || null)
      .filter(Boolean),
  };

  return {
    id: `${coupon._id?.toString?.() || coupon.id}:${assignment ? "personal" : "public"}`,
    couponId: coupon._id?.toString?.() || coupon.id,
    code: assignment?.code || coupon.code || null,
    template: coupon.template || "manual",
    audience: coupon.audience || (assignment ? "personal" : "public"),
    description: coupon.description || "",
    percentage: Number(coupon.percentage || 0),
    minSubtotal: Number(coupon.minSubtotal || 0),
    startsAt: coupon.startsAt || null,
    endsAt: coupon.endsAt || null,
    active: Boolean(coupon.active) && (assignment ? assignment.active !== false : true),
    maxUsesPerUser: perUserLimit,
    userUses: Number(userUses || 0),
    userRemainingUses: Math.max(0, perUserLimit - Number(userUses || 0)),
    maxTotalUses,
    totalUses: Number(coupon.totalUses || 0),
    targetScope: scoped ? "targeted" : "all",
    targets,
    targetItems,
    assignment: assignment
      ? {
          id: assignment._id?.toString?.() || null,
          source: assignment.source || "template_auto",
          assignedAt: assignment.createdAt || null,
          uses: Number(assignment.uses || 0),
          lastUsedAt: assignment.lastUsedAt || null,
          active: assignment.active !== false,
        }
      : null,
    canUse: availability.canUse,
    status: availability.status,
    reason: availability.reason,
  };
}

export async function listMyCoupons(req, res) {
  try {
    const userId = req.userId;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ message: "Giriş gerekli" });
    }

    const now = new Date();

    // İlk alışveriş kuponu aktifse ve kullanıcı daha önce başarılı sipariş vermediyse,
    // kupon "Kuponlarım" ekranına ilk girişte otomatik atanır.
    const hasSuccessfulOrder = await Order.exists({
      user: userId,
      status: { $in: SUCCESS_ORDER_STATUSES },
    });
    if (!hasSuccessfulOrder) {
      const firstPurchaseCoupons = await Coupon.find({
        template: "first_purchase",
        audience: "personal",
        assignmentMode: "everyone",
        active: true,
      });
      for (const coupon of firstPurchaseCoupons) {
        if (!isCouponActiveNow(coupon, now)) continue;
        await issueCouponAssignments({
          coupon,
          userIds: [userId],
          assignedBy: null,
          source: "template_auto",
        });
      }
    }

    const [assignmentsRaw, publicCouponsRaw] = await Promise.all([
      CouponAssignment.find({ user: userId })
        .populate("coupon")
        .sort({ createdAt: -1 })
        .lean(),
      Coupon.find({ audience: "public", active: true }).sort({ createdAt: -1 }).lean(),
    ]);
    const targetCatalog = await buildCouponTargetCatalog([
      ...assignmentsRaw.map((row) => row?.coupon).filter(Boolean),
      ...publicCouponsRaw,
    ]);

    const assignments = assignmentsRaw.filter((row) => row?.coupon);
    const personalCouponIds = assignments.map((row) => row.coupon?._id).filter(Boolean);
    const publicCouponIds = publicCouponsRaw.map((coupon) => coupon?._id).filter(Boolean);
    const couponIds = Array.from(
      new Set([...personalCouponIds, ...publicCouponIds].map((id) => String(id)))
    )
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const redemptionRows = couponIds.length
      ? await CouponRedemption.find(
          { user: userId, coupon: { $in: couponIds } },
          { coupon: 1, uses: 1 }
        ).lean()
      : [];
    const redemptionMap = new Map(
      redemptionRows.map((row) => [String(row.coupon), Number(row.uses || 0)])
    );

    const personalItems = assignments
      .map((assignment) => {
        const coupon = assignment.coupon;
        const userUses = Math.max(
          Number(assignment.uses || 0),
          Number(redemptionMap.get(String(coupon._id)) || 0)
        );
        return shapeUserCoupon({
          coupon,
          userUses,
          assignment,
          now,
          targetCatalog,
        });
      })
      .filter(Boolean);

    const personalIdSet = new Set(personalItems.map((item) => String(item.couponId)));
    const publicItems = publicCouponsRaw
      .filter((coupon) => !personalIdSet.has(String(coupon._id)))
      .map((coupon) =>
        shapeUserCoupon({
          coupon,
          userUses: Number(redemptionMap.get(String(coupon._id)) || 0),
          assignment: null,
          now,
          targetCatalog,
        })
      )
      .filter(Boolean);

    const priority = {
      active: 0,
      upcoming: 1,
      used_up: 2,
      total_limit: 3,
      expired: 4,
      inactive: 5,
      invalid: 6,
    };

    const coupons = [...personalItems, ...publicItems].sort((a, b) => {
      const pa = priority[a.status] ?? 99;
      const pb = priority[b.status] ?? 99;
      if (pa !== pb) return pa - pb;

      const aDate = new Date(a.startsAt || a.endsAt || 0).getTime();
      const bDate = new Date(b.startsAt || b.endsAt || 0).getTime();
      return bDate - aDate;
    });

    res.json({ coupons });
  } catch (error) {
    res.status(500).json({ message: error.message || "Kuponlar alınamadı" });
  }
}

export async function listCoupons(req, res) {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 }).lean();
    if (!coupons.length) return res.json({ coupons: [] });

    const couponIds = coupons.map((coupon) => coupon._id);
    const [assignmentAgg, redemptionAgg] = await Promise.all([
      CouponAssignment.aggregate([
        { $match: { coupon: { $in: couponIds } } },
        {
          $group: {
            _id: "$coupon",
            total: { $sum: 1 },
            used: { $sum: { $cond: [{ $gt: ["$uses", 0] }, 1, 0] } },
          },
        },
      ]),
      CouponRedemption.aggregate([
        { $match: { coupon: { $in: couponIds }, uses: { $gt: 0 } } },
        { $group: { _id: "$coupon", users: { $sum: 1 } } },
      ]),
    ]);

    res.json({ coupons: buildCouponStats(coupons, assignmentAgg, redemptionAgg) });
  } catch (error) {
    res.status(500).json({ message: error.message || "Kuponlar listelenemedi" });
  }
}

export async function createCoupon(req, res) {
  try {
    await ensureCouponCodeIndex();
    const { document, meta } = buildCouponPayload(req.body || null, null);
    await ensureUniquePublicCode(document.code);

    const coupon = await Coupon.create(document);
    const assignment = await syncCouponAssignments(
      coupon,
      meta.manualUsers,
      req.userId
    );

    res.status(201).json({
      coupon: shapeCoupon(coupon, {
        assignmentTotal: assignment.total,
        assignmentUsed: 0,
        redeemedUsers: 0,
      }),
      assignment,
    });
  } catch (error) {
    res.status(400).json({ message: error.message || "Kupon oluşturulamadı" });
  }
}

export async function updateCoupon(req, res) {
  try {
    await ensureCouponCodeIndex();
    const { id } = req.params;
    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return res.status(404).json({ message: "Kupon bulunamadı" });
    }

    const { document, meta } = buildCouponPayload(req.body || {}, coupon);
    await ensureUniquePublicCode(document.code, coupon._id);

    Object.assign(coupon, document);
    await coupon.save();

    let assignment = { total: 0, created: 0, existing: 0, eligible: 0 };
    const shouldAssignNow = parseBooleanInput(req.body?.assignNow, "assignNow");
    if (coupon.audience === "personal" && shouldAssignNow !== false) {
      assignment = await syncCouponAssignments(coupon, meta.manualUsers, req.userId);
    } else if (coupon.audience === "public") {
      await CouponAssignment.deleteMany({ coupon: coupon._id });
    }

    const [assignmentUsed, redeemedUsers] = await Promise.all([
      CouponAssignment.countDocuments({ coupon: coupon._id, uses: { $gt: 0 } }),
      CouponRedemption.countDocuments({ coupon: coupon._id, uses: { $gt: 0 } }),
    ]);

    res.json({
      coupon: shapeCoupon(coupon, {
        assignmentTotal:
          coupon.audience === "personal"
            ? await CouponAssignment.countDocuments({ coupon: coupon._id })
            : 0,
        assignmentUsed,
        redeemedUsers,
      }),
      assignment,
    });
  } catch (error) {
    res.status(400).json({ message: error.message || "Kupon güncellenemedi" });
  }
}

export async function deleteCoupon(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Geçersiz kupon id" });
    }
    await Promise.all([
      Coupon.findByIdAndDelete(id),
      CouponAssignment.deleteMany({ coupon: id }),
      CouponRedemption.deleteMany({ coupon: id }),
    ]);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ message: error.message || "Kupon silinemedi" });
  }
}

function shapeCoupon(doc, stats = {}) {
  if (!doc) return null;
  const plain = typeof doc.toObject === "function" ? doc.toObject() : doc;
  const isPersonal = plain.audience === "personal";
  return {
    id: plain._id?.toString?.() || plain.id,
    code: isPersonal ? null : plain.code || null,
    template: plain.template || "manual",
    audience: plain.audience || "public",
    assignmentMode: plain.assignmentMode || "everyone",
    autoAssignNewUsers: Boolean(plain.autoAssignNewUsers),
    manualUsers: Array.isArray(plain.manualUsers)
      ? plain.manualUsers.map((id) => id?.toString?.() || String(id))
      : [],
    description: plain.description || "",
    percentage: Number(plain.percentage || 0),
    minSubtotal: Number(plain.minSubtotal || 0),
    maxTotalUses:
      plain.maxTotalUses === null || plain.maxTotalUses === undefined
        ? null
        : Number(plain.maxTotalUses || 0),
    maxUsesPerUser: Number(plain.maxUsesPerUser || 1),
    totalUses: Number(plain.totalUses || 0),
    firstPurchaseOnly: Boolean(plain.firstPurchaseOnly),
    winbackDays:
      plain.winbackDays === null || plain.winbackDays === undefined
        ? null
        : Number(plain.winbackDays || 0),
    targets: {
      products: (plain.targets?.products || []).map((id) => String(id)),
      sets: (plain.targets?.sets || []).map((id) => String(id)),
      categories: (plain.targets?.categories || []).map((id) => String(id)),
    },
    active: Boolean(plain.active),
    startsAt: plain.startsAt || null,
    endsAt: plain.endsAt || null,
    assignmentStats: {
      total: Number(stats.assignmentTotal || 0),
      used: Number(stats.assignmentUsed || 0),
    },
    redemptionStats: {
      users: Number(stats.redeemedUsers || 0),
    },
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
}

function normalizePreviewItems(rawItems = [], fallbackSubtotal = 0) {
  const lines = [];
  const source = Array.isArray(rawItems) ? rawItems : [];

  for (const item of source) {
    if (!item || typeof item !== "object") continue;
    const kindRaw = String(
      item.kind || (item.setId ? "set" : "product")
    ).toLowerCase();
    const kind = kindRaw === "set" ? "set" : "product";
    const ref =
      item.ref ||
      item.id ||
      item._id ||
      item.productId ||
      item.setId ||
      item.product?._id ||
      item.set?._id;
    if (!ref) continue;

    const qty = Math.max(
      1,
      Number(item.qty ?? item.quantity ?? item.count ?? item.amount ?? 1) || 1
    );
    const unitPrice = Math.max(
      0,
      Number(item.unitPrice ?? item.price ?? item.finalPrice ?? 0) || 0
    );

    lines.push({
      kind,
      ref: String(ref),
      qty,
      unitPrice,
    });
  }

  if (!lines.length && Number(fallbackSubtotal || 0) > 0) {
    lines.push({
      kind: "product",
      ref: "preview-subtotal",
      qty: 1,
      unitPrice: Number(fallbackSubtotal || 0),
    });
  }

  return lines;
}

async function buildProductMapForLines(lines = []) {
  const productIds = Array.from(
    new Set(
      lines
        .filter((line) => line.kind === "product")
        .map((line) => String(line.ref || ""))
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
    )
  );
  if (!productIds.length) return new Map();

  const products = await Product.find({ _id: { $in: productIds } }).populate(
    "category",
    "ancestors"
  );
  return new Map(products.map((product) => [String(product._id), product]));
}

export async function applyCoupon(req, res) {
  try {
    const { code, items = [], subtotal = 0 } = req.body || {};
    const normalizedCode = normalizeCouponCodeInput(code);
    if (!normalizedCode) {
      return res.status(400).json({ message: "Kupon kodu gerekli" });
    }

    const orderItems = normalizePreviewItems(items, subtotal);
    const productMap = await buildProductMapForLines(orderItems);

    const result = await evaluateCouponForOrderContext({
      userId: req.userId,
      couponCode: normalizedCode,
      orderItems,
      productMap,
    });

    res.json({ coupon: result.summary });
  } catch (error) {
    const status = Number(error?.status || 0) || 400;
    const payload = { message: error.message || "Kupon uygulanamadı" };
    if (error?.details) payload.details = error.details;
    res.status(status).json(payload);
  }
}
