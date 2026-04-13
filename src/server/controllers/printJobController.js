import mongoose from "mongoose";
import Order from "../models/Order.js";
import { buildOrderLabelTspl } from "../utils/printLabelTspl.js";
import {
  canOrderCreatePrintJob,
  claimNextPendingPrintJob,
  ensurePrintJobForOrder,
  findLatestPrintJobForOrder,
  markPrintJobFailed,
  markPrintJobPrinted,
  shapePrintJob,
} from "../services/printJobService.js";

function normalizeString(value, fallback = "") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function parseBoolean(value, fallback = true) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
}

async function findOrderByIdOrNumber(orderIdOrNumber) {
  if (mongoose.Types.ObjectId.isValid(orderIdOrNumber)) {
    const byId = await Order.findById(orderIdOrNumber).populate(
      "user",
      "firstName lastName email phone"
    );
    if (byId) return byId;
  }

  return Order.findOne({ orderNumber: orderIdOrNumber }).populate(
    "user",
    "firstName lastName email phone"
  );
}

export async function claimPrintJob(req, res) {
  try {
    const agentId = normalizeString(
      req.printAgentId || req.body?.agentId,
      "print-agent"
    );
    const printerName = normalizeString(
      req.body?.printerName || process.env.PRINT_AGENT_PRINTER_NAME,
      ""
    );

    const job = await claimNextPendingPrintJob({
      agentId,
      printer: printerName,
    });

    if (!job) {
      return res.status(204).send();
    }

    return res.json({
      job: shapePrintJob(job),
      document: {
        format: "tspl",
        content: buildOrderLabelTspl(job.snapshot, { printerName }),
        snapshot: job.snapshot,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Print job alınamadı",
    });
  }
}

export async function completePrintJob(req, res) {
  try {
    const printerName = normalizeString(
      req.body?.printerName || process.env.PRINT_AGENT_PRINTER_NAME,
      ""
    );
    const job = await markPrintJobPrinted(req.params.id, {
      printer: printerName,
    });
    if (!job) {
      return res.status(404).json({ message: "Print job bulunamadı" });
    }
    return res.json({ job: shapePrintJob(job) });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Print job tamamlanamadı",
    });
  }
}

export async function failPrintJob(req, res) {
  try {
    const printerName = normalizeString(
      req.body?.printerName || process.env.PRINT_AGENT_PRINTER_NAME,
      ""
    );
    const message = normalizeString(req.body?.error, "Yazdırma hatası");
    const retryable = parseBoolean(req.body?.retryable, true);
    const job = await markPrintJobFailed(req.params.id, {
      printer: printerName,
      message,
      retryable,
    });
    if (!job) {
      return res.status(404).json({ message: "Print job bulunamadı" });
    }
    return res.json({ job: shapePrintJob(job) });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Print job hata kaydı yapılamadı",
    });
  }
}

export async function requeueOrderPrintJob(req, res) {
  try {
    const order = await findOrderByIdOrNumber(req.params.orderId);
    if (!order) {
      return res.status(404).json({ message: "Sipariş bulunamadı" });
    }

    if (!canOrderCreatePrintJob(order)) {
      return res.status(400).json({
        message: "Sadece ödemesi başarılı siparişler yeniden yazdırılabilir",
      });
    }

    const job = await ensurePrintJobForOrder(order, {
      source: "manual_requeue",
      force: true,
      requestedBy: req.userId || "",
    });

    return res.status(201).json({ job: shapePrintJob(job) });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Print job yeniden kuyruğa alınamadı",
    });
  }
}

export async function getOrderPrintJob(req, res) {
  try {
    const order = await findOrderByIdOrNumber(req.params.orderId);
    if (!order) {
      return res.status(404).json({ message: "Sipariş bulunamadı" });
    }

    const job = await findLatestPrintJobForOrder(order._id);
    return res.json({ job: shapePrintJob(job) });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Print job bilgisi alınamadı",
    });
  }
}
