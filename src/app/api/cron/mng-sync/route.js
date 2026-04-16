/**
 * Cron endpoint: MNG Kargo durum senkronizasyonu
 *
 * GET /api/cron/mng-sync
 *
 * Güvenlik: MNG_CRON_SECRET env değişkeni ile korunur.
 * İstek header'ında şunu gönder:  Authorization: Bearer <MNG_CRON_SECRET>
 *
 * Vercel Cron örneği (vercel.json):
 * {
 *   "crons": [{ "path": "/api/cron/mng-sync", "schedule": "0 * * * *" }]
 * }
 *
 * Harici cron (crontab, GitHub Actions, vb.):
 *   curl -H "Authorization: Bearer $MNG_CRON_SECRET" https://siteniniz.com/api/cron/mng-sync
 */

import { NextResponse } from "next/server";
import Order from "../../../../server/models/Order.js";
import { connectDB } from "../../../../server/config/db.js";
import {
  fetchStatusChangedShipments,
  MNG_STATUS,
  normalizeShipmentRecord,
} from "../../../../server/services/mngKargoService.js";
import { sendOrderShippedSms } from "../../../../server/services/smsService.js";

const CRON_SECRET = process.env.MNG_CRON_SECRET || "";

export async function GET(request) {
  // Güvenlik kontrolü
  if (CRON_SECRET) {
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (token !== CRON_SECRET) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
    }
  }

  await connectDB();

  // Son 3 saatte durum değişen gönderileri sorgula
  const since = new Date(Date.now() - 3 * 60 * 60 * 1000);

  let shipments;
  try {
    shipments = await fetchStatusChangedShipments(since);
  } catch (err) {
    console.error("MNG sync: fetchStatusChangedShipments hatası:", err?.message);
    return NextResponse.json({ error: err?.message || "MNG sorgu hatası" }, { status: 502 });
  }

  if (!shipments.length) {
    return NextResponse.json({ synced: 0, message: "Durum değişen gönderi yok" });
  }

  let synced = 0;
  let errors = 0;

  for (const item of shipments) {
    const normalized = normalizeShipmentRecord(item);
    const referenceId = normalized.referenceId;
    const statusCode =
      normalized.statusCode !== null && normalized.statusCode !== undefined
        ? Number(normalized.statusCode)
        : null;
    if (!referenceId) continue;

    try {
      const order = await Order.findOne({ orderNumber: referenceId });
      if (!order) continue;

      const statusLabel = MNG_STATUS[statusCode] || null;
      const isDelivered = statusCode === 5;

      // tracking alanını güncelle
      if (!order.tracking) order.tracking = {};
      order.tracking.provider = order.tracking.provider || "mng";
      order.tracking.referenceId =
        normalized.referenceId || order.tracking.referenceId || null;
      order.tracking.shipmentId =
        normalized.shipmentId || order.tracking.shipmentId || null;
      order.tracking.statusCode = statusCode ?? order.tracking.statusCode;
      order.tracking.statusLabel = statusLabel || order.tracking.statusLabel;
      order.tracking.estimatedDeliveryDate =
        normalized.estimatedDeliveryDate ||
        order.tracking.estimatedDeliveryDate ||
        null;
      order.tracking.lastSyncedAt = new Date();

      if (normalized.trackingUrl) {
        order.tracking.trackingUrl = normalized.trackingUrl;
      }

      const hadBarcode = Boolean(order.tracking.barcode);
      if (normalized.barcode) {
        order.tracking.barcode = normalized.barcode;
      }
      const barcodeJustArrived = !hadBarcode && Boolean(order.tracking.barcode);

      if (isDelivered && !order.tracking.deliveredAt) {
        order.tracking.deliveredAt = new Date();
      }

      // Teslim edildiyse siparişi "completed" yap
      if (isDelivered && order.status === "shipped") {
        order.status = "completed";
      }

      order.markModified("tracking");
      await order.save();
      synced++;

      if (barcodeJustArrived) {
        sendOrderShippedSms(order).catch((err) =>
          console.error("SMS (kargo) gönderilemedi:", { orderId: order._id?.toString(), error: err?.message })
        );
      }
    } catch (err) {
      console.error("MNG sync: sipariş güncellenemedi:", {
        referenceId,
        error: err?.message,
      });
      errors++;
    }
  }

  return NextResponse.json({
    synced,
    errors,
    total: shipments.length,
    since: since.toISOString(),
  });
}
