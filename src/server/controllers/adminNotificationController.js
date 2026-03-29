import AdminNotification from "../models/AdminNotification.js";

function parseLimit(value, fallback = 12) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(50, Math.max(1, Math.floor(parsed)));
}

function shapeNotification(doc) {
  const plain = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return {
    id: String(plain._id),
    type: plain.type,
    ownerModel: plain.ownerModel,
    owner: plain.owner?.toString?.() || plain.owner || "",
    stockItem: plain.stockItem?.toString?.() || plain.stockItem || null,
    comboKey: plain.comboKey || "",
    title: plain.title || "",
    message: plain.message || "",
    read: Boolean(plain.readAt),
    readAt: plain.readAt || null,
    createdAt: plain.createdAt || null,
    data: {
      productName: plain.data?.productName || "",
      productSlug: plain.data?.productSlug || "",
      image: plain.data?.image || "",
      color: plain.data?.color || null,
      size: plain.data?.size || null,
      attributeValue: plain.data?.attributeValue || null,
      variantLabel: plain.data?.variantLabel || "",
      previousQty: Number(plain.data?.previousQty || 0) || 0,
      qtyOnHand: Number(plain.data?.qtyOnHand || 0) || 0,
      threshold: Number(plain.data?.threshold || 3) || 3,
      targetType: plain.data?.targetType || "",
      targetName: plain.data?.targetName || "",
      targetSlug: plain.data?.targetSlug || "",
      reviewId: plain.data?.reviewId || "",
      reviewerName: plain.data?.reviewerName || "",
      reviewerEmail: plain.data?.reviewerEmail || "",
      rating: Number(plain.data?.rating || 0) || 0,
      reviewTitle: plain.data?.reviewTitle || "",
      reviewBody: plain.data?.reviewBody || "",
    },
  };
}

export async function listAdminNotifications(req, res) {
  try {
    const limit = parseLimit(req.query.limit, 12);
    const [items, unreadCount] = await Promise.all([
      AdminNotification.find({})
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
      AdminNotification.countDocuments({ readAt: null }),
    ]);

    res.json({
      items: items.map(shapeNotification),
      unreadCount,
    });
  } catch (err) {
    res.status(500).json({
      message: err.message || "Bildirimler alınamadı",
    });
  }
}

export async function markAdminNotificationsRead(req, res) {
  try {
    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids.map((id) => String(id || "").trim()).filter(Boolean)
      : [];

    const query = ids.length
      ? { _id: { $in: ids }, readAt: null }
      : { readAt: null };

    await AdminNotification.updateMany(query, {
      $set: { readAt: new Date() },
    });

    const unreadCount = await AdminNotification.countDocuments({ readAt: null });

    res.json({ ok: true, unreadCount });
  } catch (err) {
    res.status(500).json({
      message: err.message || "Bildirimler güncellenemedi",
    });
  }
}
