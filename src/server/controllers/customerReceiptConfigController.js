import CustomerReceiptConfig from "../models/CustomerReceiptConfig.js";
import { normalizeCustomerReceiptConfig } from "../../shared/customerReceiptConfig.js";

function shapeCustomerReceiptConfig(config) {
  const normalized = normalizeCustomerReceiptConfig(config || {});
  return {
    ...normalized,
    updatedAt: config?.updatedAt || null,
  };
}

export async function getCustomerReceiptConfig(req, res) {
  try {
    const config = await CustomerReceiptConfig.getSingleton();
    return res.json({
      customerReceiptConfig: shapeCustomerReceiptConfig(config),
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Musteri fisi ayarlari yuklenemedi",
    });
  }
}

export async function updateCustomerReceiptConfig(req, res) {
  try {
    const payload = normalizeCustomerReceiptConfig(req.body || {});
    const config = await CustomerReceiptConfig.getSingleton();
    config.slogan = payload.slogan;
    config.message = payload.message;
    config.instagramUrl = payload.instagramUrl;
    config.tiktokUrl = payload.tiktokUrl;
    await config.save();

    return res.json({
      customerReceiptConfig: shapeCustomerReceiptConfig(config),
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Musteri fisi ayarlari guncellenemedi",
    });
  }
}

export async function resolveCustomerReceiptConfig() {
  const config = await CustomerReceiptConfig.getSingleton();
  return shapeCustomerReceiptConfig(config);
}
