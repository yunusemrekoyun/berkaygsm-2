import crypto from "crypto";
import mongoose from "mongoose";
import Coupon from "../models/Coupon.js";
import CouponAssignment from "../models/CouponAssignment.js";
import CouponRedemption from "../models/CouponRedemption.js";
import Order from "../models/Order.js";
import User from "../models/User.js";

const SAFE_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MANUAL_CODE_RE = /^[A-Z2-9]{4,32}$/;
const SUCCESS_ORDER_STATUSES = ["paid", "shipped", "completed"];

export const COUPON_TEMPLATES = Object.freeze([
  "first_purchase",
  "cart_threshold",
  "category_specific",
  "winback",
  "manual",
]);

export function normalizeCouponCodeInput(code) {
  if (code === undefined || code === null) return "";
  return String(code).trim();
}

export function isValidManualCouponCode(code) {
  return MANUAL_CODE_RE.test(String(code || ""));
}

export function parseIstanbulDateInput(value, field = "date") {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error(`${field} geçerli bir tarih olmalı`);
    }
    return value;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  let normalized = raw;
  // timezone yoksa Europe/Istanbul (+03:00) varsay.
  if (
    /^\d{4}-\d{2}-\d{2}$/.test(raw)
  ) {
    normalized = `${raw}T00:00:00+03:00`;
  } else if (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)
  ) {
    normalized = `${raw}:00+03:00`;
  } else if (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(raw)
  ) {
    normalized = `${raw}+03:00`;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${field} geçerli bir tarih olmalı`);
  }
  return parsed;
}

export function validateDateRange(startsAt, endsAt) {
  if (startsAt && endsAt && startsAt.getTime() > endsAt.getTime()) {
    throw new Error("Başlangıç tarihi bitiş tarihinden sonra olamaz");
  }
}

export function isCouponActiveNow(coupon, now = new Date()) {
  if (!coupon?.active) return false;
  if (coupon.startsAt && new Date(coupon.startsAt).getTime() > now.getTime()) {
    return false;
  }
  if (coupon.endsAt && new Date(coupon.endsAt).getTime() < now.getTime()) {
    return false;
  }
  return true;
}

function createError(status, message, details = null) {
  const error = new Error(message);
  error.status = status;
  if (details && Object.keys(details).length) {
    error.details = details;
  }
  return error;
}

function normalizeIdSet(list = []) {
  return new Set(
    (Array.isArray(list) ? list : [])
      .map((value) => value?.toString?.() || String(value || ""))
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

export async function generateUniqueCouponCode(length = 9) {
  const safeLength = Math.max(6, Number(length) || 9);
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const random = crypto.randomBytes(safeLength);
    let code = "";
    for (let i = 0; i < safeLength; i += 1) {
      code += SAFE_CODE_CHARS[random[i] % SAFE_CODE_CHARS.length];
    }

    const [couponHit, assignmentHit] = await Promise.all([
      Coupon.exists({ code }),
      CouponAssignment.exists({ code }),
    ]);
    if (!couponHit && !assignmentHit) return code;
  }
  throw new Error("Kupon kodu üretilemedi, tekrar deneyin");
}

export async function issueCouponAssignments({
  coupon,
  userIds = [],
  assignedBy = null,
  source = "template_auto",
}) {
  if (!coupon || coupon.audience !== "personal") {
    return { total: 0, created: 0, existing: 0 };
  }
  const dedupedIds = Array.from(
    new Set(
      (Array.isArray(userIds) ? userIds : [])
        .map((id) => id?.toString?.() || String(id || ""))
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
    )
  );
  if (!dedupedIds.length) {
    return { total: 0, created: 0, existing: 0 };
  }

  const existing = await CouponAssignment.find(
    { coupon: coupon._id, user: { $in: dedupedIds } },
    { user: 1 }
  ).lean();
  const existingUserSet = new Set(existing.map((doc) => String(doc.user)));

  const documents = [];
  for (const userId of dedupedIds) {
    if (existingUserSet.has(userId)) continue;
    const code = await generateUniqueCouponCode(9);
    documents.push({
      coupon: coupon._id,
      user: userId,
      code,
      active: true,
      assignedBy: assignedBy && mongoose.Types.ObjectId.isValid(assignedBy)
        ? assignedBy
        : null,
      source,
    });
  }

  if (documents.length) {
    await CouponAssignment.insertMany(documents, { ordered: false });
  }

  return {
    total: dedupedIds.length,
    created: documents.length,
    existing: dedupedIds.length - documents.length,
  };
}

export async function assignCouponByMode({
  coupon,
  assignedBy = null,
  manualUserIds = null,
}) {
  if (!coupon || coupon.audience !== "personal") {
    return { total: 0, created: 0, existing: 0 };
  }

  let targetUserIds = [];
  if (coupon.assignmentMode === "manual") {
    const sourceIds =
      manualUserIds ?? coupon.manualUsers ?? [];
    targetUserIds = sourceIds
      .map((id) => id?.toString?.() || String(id || ""))
      .filter((id) => mongoose.Types.ObjectId.isValid(id));
  } else {
    const users = await User.find(
      { role: "user", isDeleted: { $ne: true } },
      { _id: 1 }
    ).lean();
    targetUserIds = users.map((user) => String(user._id));
  }

  return issueCouponAssignments({
    coupon,
    userIds: targetUserIds,
    assignedBy,
    source:
      coupon.assignmentMode === "manual"
        ? "template_manual"
        : "template_auto",
  });
}

export async function issueAutoCouponsForNewUser(userId) {
  if (!mongoose.Types.ObjectId.isValid(userId)) return;
  const now = new Date();
  const coupons = await Coupon.find({
    audience: "personal",
    autoAssignNewUsers: true,
    active: true,
  });
  for (const coupon of coupons) {
    if (!isCouponActiveNow(coupon, now)) continue;
    await issueCouponAssignments({
      coupon,
      userIds: [userId],
      assignedBy: null,
      source: "template_auto",
    });
  }
}

function hasCouponTargets(coupon) {
  const targets = coupon?.targets || {};
  return Boolean(
    (targets.products && targets.products.length) ||
      (targets.sets && targets.sets.length) ||
      (targets.categories && targets.categories.length)
  );
}

function calculateEligibleSubtotal(coupon, orderItems = [], productMap = new Map()) {
  const lines = Array.isArray(orderItems) ? orderItems : [];
  if (!hasCouponTargets(coupon)) {
    return lines.reduce(
      (sum, line) =>
        sum + Number(line?.unitPrice || 0) * Number(line?.qty || 0),
      0
    );
  }

  const targetProducts = normalizeIdSet(coupon.targets?.products || []);
  const targetSets = normalizeIdSet(coupon.targets?.sets || []);
  const targetCategories = normalizeIdSet(coupon.targets?.categories || []);

  let eligibleSubtotal = 0;
  for (const line of lines) {
    const kind = String(line?.kind || "product").toLowerCase();
    const refId = line?.ref?.toString?.() || String(line?.ref || "");
    const lineTotal =
      Number(line?.unitPrice || 0) * Number(line?.qty || 0);

    if (kind === "set") {
      if (targetSets.has(refId)) {
        eligibleSubtotal += lineTotal;
      }
      continue;
    }

    if (targetProducts.has(refId)) {
      eligibleSubtotal += lineTotal;
      continue;
    }

    if (!targetCategories.size) continue;
    const product = productMap.get(refId);
    if (!product?.category) continue;
    const categoryIds = [
      product.category?._id?.toString?.() || product.category?.toString?.(),
      ...(Array.isArray(product.category?.ancestors)
        ? product.category.ancestors.map((id) => id?.toString?.())
        : []),
    ].filter(Boolean);

    if (categoryIds.some((id) => targetCategories.has(id))) {
      eligibleSubtotal += lineTotal;
    }
  }

  return eligibleSubtotal;
}

async function assertCouponUserEligibility({
  coupon,
  userId,
  now = new Date(),
}) {
  if (coupon.firstPurchaseOnly || coupon.template === "first_purchase") {
    const successfulOrderExists = await Order.exists({
      user: userId,
      status: { $in: SUCCESS_ORDER_STATUSES },
    });
    if (successfulOrderExists) {
      throw createError(
        400,
        "Bu kupon yalnızca ilk başarılı siparişte kullanılabilir",
        { reason: "firstPurchaseOnly" }
      );
    }
  }

  const winbackDays = Number(coupon.winbackDays || 0);
  if (winbackDays > 0) {
    const lastSuccessfulOrder = await Order.findOne(
      { user: userId, status: { $in: SUCCESS_ORDER_STATUSES } },
      { createdAt: 1 }
    )
      .sort({ createdAt: -1 })
      .lean();
    if (lastSuccessfulOrder?.createdAt) {
      const diffDays =
        (now.getTime() - new Date(lastSuccessfulOrder.createdAt).getTime()) /
        (1000 * 60 * 60 * 24);
      if (diffDays < winbackDays) {
        throw createError(
          400,
          `${winbackDays} gün sipariş vermeme koşulu henüz sağlanmadı`,
          {
            reason: "winbackDays",
            requiredDays: winbackDays,
            currentDays: Math.floor(Math.max(0, diffDays)),
          }
        );
      }
    }
  }
}

async function resolveCouponByCodeForUser({
  userId,
  code,
  now = new Date(),
}) {
  const assignment = await CouponAssignment.findOne({
    code,
    user: userId,
    active: true,
  }).populate("coupon");

  if (assignment?.coupon && isCouponActiveNow(assignment.coupon, now)) {
    return { coupon: assignment.coupon, assignment };
  }

  const coupon = await Coupon.findOne({
    code,
    audience: "public",
  });
  if (coupon && isCouponActiveNow(coupon, now)) {
    return { coupon, assignment: null };
  }

  return { coupon: null, assignment: null };
}

export async function evaluateCouponForOrderContext({
  userId,
  couponCode,
  orderItems = [],
  productMap = new Map(),
  now = new Date(),
}) {
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    throw createError(401, "Kupon kullanmak için giriş yapmalısınız");
  }

  const code = normalizeCouponCodeInput(couponCode);
  if (!code) {
    throw createError(400, "Kupon kodu gerekli");
  }

  const { coupon, assignment } = await resolveCouponByCodeForUser({
    userId,
    code,
    now,
  });
  if (!coupon) {
    throw createError(404, "Kupon bulunamadı veya pasif", { code });
  }

  await assertCouponUserEligibility({ coupon, userId, now });

  const maxUsesPerUser = Math.max(1, Number(coupon.maxUsesPerUser || 1));
  const redemption = await CouponRedemption.findOne(
    { coupon: coupon._id, user: userId },
    { uses: 1 }
  ).lean();
  const currentUserUses = Number(redemption?.uses || 0);
  if (currentUserUses >= maxUsesPerUser) {
    throw createError(400, "Bu kuponu kullanım hakkınız doldu", {
      reason: "perUserLimit",
      maxUsesPerUser,
    });
  }

  const maxTotalUses = Number(coupon.maxTotalUses || 0);
  if (maxTotalUses > 0 && Number(coupon.totalUses || 0) >= maxTotalUses) {
    throw createError(400, "Kuponun kullanım limiti doldu", {
      reason: "totalLimit",
      maxTotalUses,
    });
  }

  const eligibleSubtotal = Math.round(
    calculateEligibleSubtotal(coupon, orderItems, productMap) * 100
  ) / 100;
  const minSubtotal = Number(coupon.minSubtotal || 0);
  if (eligibleSubtotal < minSubtotal) {
    throw createError(400, `Kupon için minimum ara toplam ${minSubtotal} olmalı`, {
      reason: "minSubtotal",
      minSubtotal,
      eligibleSubtotal,
    });
  }

  const discountAmount =
    Math.round(((eligibleSubtotal * Number(coupon.percentage || 0)) / 100) * 100) / 100;
  if (discountAmount <= 0) {
    throw createError(400, "Kupon bu sepet için uygulanamıyor", {
      reason: "notApplicable",
      eligibleSubtotal,
    });
  }

  return {
    summary: {
      code,
      description: coupon.description || "",
      percentage: Number(coupon.percentage || 0),
      minSubtotal,
      eligibleSubtotal,
      discountAmount,
      template: coupon.template || "manual",
      audience: coupon.audience || "public",
    },
    context: {
      couponId: String(coupon._id),
      assignmentId: assignment?._id?.toString?.() || null,
      code,
      audience: coupon.audience || "public",
      maxUsesPerUser,
    },
  };
}

async function incrementCouponTotalUses(couponId, maxTotalUses) {
  if (maxTotalUses > 0) {
    const updated = await Coupon.findOneAndUpdate(
      { _id: couponId, totalUses: { $lt: maxTotalUses } },
      { $inc: { totalUses: 1 } },
      { new: true }
    ).lean();
    if (!updated) {
      throw createError(400, "Kuponun kullanım limiti doldu", {
        reason: "totalLimit",
        maxTotalUses,
      });
    }
    return updated;
  }

  await Coupon.updateOne({ _id: couponId }, { $inc: { totalUses: 1 } });
  return null;
}

export async function consumeCouponAfterSuccess({
  userId,
  couponContext = null,
  orderId = null,
}) {
  if (!couponContext?.couponId || !mongoose.Types.ObjectId.isValid(userId)) {
    return null;
  }

  const coupon = await Coupon.findById(couponContext.couponId);
  if (!coupon) return null;

  const maxUsesPerUser = Math.max(1, Number(coupon.maxUsesPerUser || 1));
  const maxTotalUses = Math.max(0, Number(coupon.maxTotalUses || 0));
  const now = new Date();

  let redemptionUpdated = false;
  let assignmentUpdated = false;

  try {
    const redemption = await CouponRedemption.findOneAndUpdate(
      {
        coupon: coupon._id,
        user: userId,
        uses: { $lt: maxUsesPerUser },
      },
      {
        $inc: { uses: 1 },
        $set: {
          lastUsedAt: now,
          lastOrder: orderId && mongoose.Types.ObjectId.isValid(orderId)
            ? orderId
            : null,
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    ).lean();

    if (!redemption) {
      throw createError(400, "Bu kuponu kullanım hakkınız doldu", {
        reason: "perUserLimit",
      });
    }
    redemptionUpdated = true;

    if (couponContext.assignmentId) {
      await CouponAssignment.updateOne(
        {
          _id: couponContext.assignmentId,
          coupon: coupon._id,
          user: userId,
          active: true,
        },
        {
          $inc: { uses: 1 },
          $set: {
            lastUsedAt: now,
            lastOrder: orderId && mongoose.Types.ObjectId.isValid(orderId)
              ? orderId
              : null,
          },
        }
      );
      assignmentUpdated = true;
    }

    await incrementCouponTotalUses(coupon._id, maxTotalUses);
    return { ok: true };
  } catch (error) {
    if (redemptionUpdated) {
      await CouponRedemption.updateOne(
        { coupon: coupon._id, user: userId, uses: { $gt: 0 } },
        { $inc: { uses: -1 } }
      );
    }
    if (assignmentUpdated && couponContext.assignmentId) {
      await CouponAssignment.updateOne(
        { _id: couponContext.assignmentId, uses: { $gt: 0 } },
        { $inc: { uses: -1 } }
      );
    }
    throw error;
  }
}
