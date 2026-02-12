import Coupon from "../models/Coupon.js";

function normalizeCode(code) {
  return String(code || "")
    .trim()
    .toUpperCase();
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
    if (["true", "1", "yes"].includes(normalized)) return true;
    if (["false", "0", "no"].includes(normalized)) return false;
  }
  throw new Error(`${field} alanı true/false olmalı`);
}

function parseNullableDate(value, field) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${field} geçerli bir tarih olmalı`);
  }
  return parsed;
}

function validateDateRange(startsAt, endsAt) {
  if (startsAt && endsAt && startsAt.getTime() > endsAt.getTime()) {
    throw new Error("Başlangıç tarihi bitiş tarihinden sonra olamaz");
  }
}

export async function listCoupons(req, res) {
  const coupons = await Coupon.find().sort({ createdAt: -1 }).lean();
  res.json({ coupons: coupons.map(shapeCoupon) });
}

export async function createCoupon(req, res) {
  try {
    const {
      code,
      description = "",
      percentage,
      minSubtotal = 0,
      active = true,
      startsAt,
      endsAt,
    } = req.body;
    const normalized = normalizeCode(code);
    if (!normalized) {
      return res.status(400).json({ message: "Kupon kodu gerekli" });
    }
    const parsedPercentage = Number(percentage);
    if (!Number.isFinite(parsedPercentage) || parsedPercentage <= 0 || parsedPercentage > 100) {
      return res.status(400).json({ message: "Yüzde 1-100 arasında olmalı" });
    }
    const parsedMin = Number(minSubtotal ?? 0);
    if (!Number.isFinite(parsedMin) || parsedMin < 0) {
      return res
        .status(400)
        .json({ message: "Minimum sepet tutarı 0 veya daha büyük olmalı" });
    }
    const parsedActive = parseBooleanInput(active, "active");
    const parsedStartsAt = parseNullableDate(startsAt, "startsAt");
    const parsedEndsAt = parseNullableDate(endsAt, "endsAt");
    validateDateRange(parsedStartsAt, parsedEndsAt);

    const existing = await Coupon.findOne({ code: normalized });
    if (existing) {
      return res.status(409).json({ message: "Kupon kodu zaten mevcut" });
    }

    const coupon = await Coupon.create({
      code: normalized,
      description,
      percentage: parsedPercentage,
      minSubtotal: parsedMin,
      active: parsedActive ?? true,
      startsAt: parsedStartsAt ?? null,
      endsAt: parsedEndsAt ?? null,
    });
    res.status(201).json({ coupon: shapeCoupon(coupon) });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

export async function updateCoupon(req, res) {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return res.status(404).json({ message: "Kupon bulunamadı" });
    }

    const { code, description, percentage, minSubtotal, active, startsAt, endsAt } = req.body;
    if (code !== undefined) {
      const normalized = normalizeCode(code);
      if (!normalized) {
        return res.status(400).json({ message: "Kupon kodu boş olamaz" });
      }
      const exists = await Coupon.findOne({ code: normalized, _id: { $ne: coupon._id } });
      if (exists) {
        return res.status(409).json({ message: "Kupon kodu zaten mevcut" });
      }
      coupon.code = normalized;
    }
    if (description !== undefined) coupon.description = String(description);
    if (percentage !== undefined) {
      const parsed = Number(percentage);
      if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100) {
        return res.status(400).json({ message: "Yüzde 1-100 arasında olmalı" });
      }
      coupon.percentage = parsed;
    }
    if (minSubtotal !== undefined) {
      const parsed = Number(minSubtotal);
      if (!Number.isFinite(parsed) || parsed < 0) {
        return res
          .status(400)
          .json({ message: "Minimum sepet tutarı 0 veya daha büyük olmalı" });
      }
      coupon.minSubtotal = parsed;
    }
    const parsedActive = parseBooleanInput(active, "active");
    if (parsedActive !== undefined) coupon.active = parsedActive;
    const parsedStartsAt = parseNullableDate(startsAt, "startsAt");
    if (parsedStartsAt !== undefined) coupon.startsAt = parsedStartsAt;
    const parsedEndsAt = parseNullableDate(endsAt, "endsAt");
    if (parsedEndsAt !== undefined) coupon.endsAt = parsedEndsAt;
    validateDateRange(
      coupon.startsAt ? new Date(coupon.startsAt) : null,
      coupon.endsAt ? new Date(coupon.endsAt) : null
    );

    await coupon.save();
    res.json({ coupon: shapeCoupon(coupon) });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

export async function deleteCoupon(req, res) {
  try {
    const { id } = req.params;
    await Coupon.findByIdAndDelete(id);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

function shapeCoupon(doc) {
  if (!doc) return null;
  const plain = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return {
    id: plain._id?.toString?.() || plain.id,
    code: plain.code,
    description: plain.description,
    percentage: plain.percentage,
    minSubtotal: plain.minSubtotal || 0,
    active: !!plain.active,
    startsAt: plain.startsAt,
    endsAt: plain.endsAt,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
}

export async function applyCoupon(req, res) {
  try {
    const { code, subtotal } = req.body || {};
    const normalized = normalizeCode(code);
    if (!normalized) {
      return res.status(400).json({ message: "Kupon kodu gerekli" });
    }
    const subtotalValue = Number(subtotal) || 0;

    const now = new Date();
    const coupon = await Coupon.findOne({
      code: normalized,
      active: true,
      $and: [
        { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
        { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
      ],
    }).lean();

    if (!coupon) {
      return res.status(404).json({ message: "Kupon bulunamadı veya pasif" });
    }

    if (subtotalValue < (coupon.minSubtotal || 0)) {
      return res.status(400).json({
        message: `Kupon için minimum ara toplam ${coupon.minSubtotal} olmalı`,
        reason: "minSubtotal",
        minSubtotal: coupon.minSubtotal,
      });
    }

    res.json({
      coupon: {
        code: coupon.code,
        description: coupon.description,
        percentage: coupon.percentage,
        minSubtotal: coupon.minSubtotal,
      },
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}
