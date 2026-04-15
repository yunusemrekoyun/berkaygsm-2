import AnnouncementBanner from "../models/AnnouncementBanner.js";

function shapePublic(doc) {
  return {
    isEnabled: Boolean(doc.isEnabled),
    text: String(doc.text || ""),
    bgColor: String(doc.bgColor || "#0c4a6e"),
    textColor: String(doc.textColor || "#ffffff"),
  };
}

function shapeManage(doc) {
  return {
    ...shapePublic(doc),
    id: doc._id?.toString(),
    updatedAt: doc.updatedAt ?? null,
  };
}

/** GET /api/announcement-banner — public storefront */
export async function getAnnouncementBannerPublic(req, res) {
  try {
    const doc = await AnnouncementBanner.getSingleton();
    res.json({ banner: shapePublic(doc) });
  } catch (err) {
    res.status(500).json({ message: err?.message || "Banner yüklenemedi" });
  }
}

/** GET /api/announcement-banner/manage — admin */
export async function getAnnouncementBannerManage(req, res) {
  try {
    const doc = await AnnouncementBanner.getSingleton();
    res.json({ banner: shapeManage(doc) });
  } catch (err) {
    res.status(500).json({ message: err?.message || "Banner yüklenemedi" });
  }
}

/** PUT /api/announcement-banner/manage — admin */
export async function updateAnnouncementBannerManage(req, res) {
  try {
    const { isEnabled, text, bgColor, textColor } = req.body || {};
    const doc = await AnnouncementBanner.getSingleton();

    if (isEnabled !== undefined) doc.isEnabled = Boolean(isEnabled);
    if (text !== undefined) doc.text = String(text ?? "").trim();
    if (bgColor !== undefined) doc.bgColor = String(bgColor || "#0c4a6e").trim();
    if (textColor !== undefined) doc.textColor = String(textColor || "#ffffff").trim();

    await doc.save();
    res.json({ banner: shapeManage(doc) });
  } catch (err) {
    res.status(500).json({ message: err?.message || "Banner güncellenemedi" });
  }
}
