import { buildOrderPreparation } from "./orderController.js";

const PAYTR_REQUIRED_ENV_KEYS = [
  "PAYTR_MERCHANT_ID",
  "PAYTR_MERCHANT_KEY",
  "PAYTR_MERCHANT_SALT",
  "PAYTR_CALLBACK_URL",
];

function toBoolean(value) {
  if (typeof value === "boolean") return value;
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
}

function collectMissingPaytrConfig() {
  return PAYTR_REQUIRED_ENV_KEYS.filter(
    (key) => !String(process.env[key] || "").trim()
  );
}

export async function createPaytrCheckout(req, res) {
  try {
    const paytrEnabled = toBoolean(process.env.PAYTR_ENABLED);
    if (!paytrEnabled) {
      return res.status(503).json({
        code: "PAYTR_DISABLED",
        ready: false,
        message: "PayTR entegrasyonu henüz etkin değil.",
      });
    }

    const missingConfig = collectMissingPaytrConfig();
    if (missingConfig.length) {
      return res.status(503).json({
        code: "PAYTR_CONFIG_INCOMPLETE",
        ready: false,
        message: "PayTR yapılandırması eksik.",
        details: { missing: missingConfig },
      });
    }

    const {
      addressId,
      addressSnapshot = null,
      items = [],
      couponCode = null,
      note = null,
    } = req.body || {};

    const preparation = await buildOrderPreparation({
      userId: req.userId,
      addressId,
      addressSnapshot,
      items,
      couponCode,
    });

    return res.status(501).json({
      code: "PAYTR_NOT_READY",
      ready: false,
      message:
        "PayTR seçeneği hazırlandı ancak canlı ödeme yönlendirmesi henüz açılmadı.",
      summary: preparation.summary,
      note: note || null,
    });
  } catch (err) {
    if (err.status) {
      const payload = { message: err.message || "Ödeme başlatılamadı" };
      if (err.extra || err.details) payload.details = err.extra || err.details;
      return res.status(err.status).json(payload);
    }
    return res.status(500).json({
      message: err.message || "Ödeme akışı başlatılamadı",
    });
  }
}
