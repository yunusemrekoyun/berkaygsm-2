import CouponConfig from "../models/CouponConfig.js";

function shapeCouponConfig(config) {
  if (!config) return null;
  return {
    id: config._id?.toString?.() || config.id,
    cartInputVisible: config.cartInputVisible !== false,
    updatedAt: config.updatedAt || null,
  };
}

function parseBoolean(value, fallback = true) {
  if (value === undefined) return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
}

export async function getCouponConfig(req, res) {
  try {
    const config = await CouponConfig.getSingleton();
    res.json({ config: shapeCouponConfig(config) });
  } catch (error) {
    res.status(500).json({
      message: error.message || "Kupon ayarları alınamadı",
    });
  }
}

export async function updateCouponConfig(req, res) {
  try {
    const config = await CouponConfig.getSingleton();
    if (req.body && Object.prototype.hasOwnProperty.call(req.body, "cartInputVisible")) {
      config.cartInputVisible = parseBoolean(req.body.cartInputVisible, true);
    }
    await config.save();
    res.json({ config: shapeCouponConfig(config) });
  } catch (error) {
    res.status(500).json({
      message: error.message || "Kupon ayarları güncellenemedi",
    });
  }
}
