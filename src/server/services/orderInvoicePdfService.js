import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { getMediaRootDir } from "../media/config.js";

const PDF_HEADER = "%PDF-";
const PRIVATE_INVOICE_ROOT = "private/order-invoices";

function sanitizeSegment(value, fallback = "file") {
  const normalized = String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function normalizeOrderId(order) {
  return sanitizeSegment(order?._id?.toString?.() || order?.id || "", "order");
}

function getRelativeInvoicePath(order, assetId) {
  return [
    PRIVATE_INVOICE_ROOT,
    normalizeOrderId(order),
    sanitizeSegment(assetId, randomUUID()),
    "invoice.pdf",
  ].join("/");
}

function resolveInsideMediaRoot(relativePath) {
  const mediaRoot = getMediaRootDir();
  const absolute = path.resolve(mediaRoot, ...String(relativePath || "").split("/"));
  const normalizedRoot = path.resolve(mediaRoot);
  if (absolute !== normalizedRoot && !absolute.startsWith(`${normalizedRoot}${path.sep}`)) {
    throw new Error("Geçersiz fatura dosya yolu");
  }
  return absolute;
}

function assertPdfFile(file) {
  if (!file?.buffer || !Buffer.isBuffer(file.buffer)) {
    throw Object.assign(new Error("PDF dosyası gerekli"), { status: 400 });
  }

  const mime = String(file.mimetype || "").toLowerCase();
  const name = String(file.originalname || "").toLowerCase();
  const hasPdfMime = mime === "application/pdf" || mime === "application/octet-stream";
  const hasPdfName = name.endsWith(".pdf");
  const header = file.buffer.subarray(0, PDF_HEADER.length).toString("utf8");

  if ((!hasPdfMime && !hasPdfName) || header !== PDF_HEADER) {
    throw Object.assign(new Error("Yalnızca geçerli PDF dosyası yüklenebilir"), {
      status: 415,
    });
  }
}

export async function removeStoredOrderInvoicePdf(invoicePdf = null) {
  const relativePath = String(invoicePdf?.storagePath || "").trim();
  if (!relativePath) return;

  const absolutePath = resolveInsideMediaRoot(relativePath);
  await fs.rm(path.dirname(absolutePath), { recursive: true, force: true });
}

export async function saveOrderInvoicePdf({ order, file, uploadedBy = null }) {
  assertPdfFile(file);

  const assetId = `${Date.now()}-${randomUUID()}`;
  const storagePath = getRelativeInvoicePath(order, assetId);
  const absolutePath = resolveInsideMediaRoot(storagePath);
  const assetDir = path.dirname(absolutePath);
  const originalName = sanitizeSegment(file.originalname || "invoice.pdf", "invoice.pdf");

  await fs.mkdir(assetDir, { recursive: true });
  await fs.writeFile(absolutePath, file.buffer);
  await fs.writeFile(
    path.join(assetDir, "invoice.json"),
    JSON.stringify(
      {
        resourceType: "raw",
        mimeType: "application/pdf",
        originalName,
        bytes: file.buffer.length,
        storagePath,
        uploadedAt: new Date().toISOString(),
      },
      null,
      2
    ),
    "utf8"
  );

  return {
    storagePath,
    originalName,
    filename: "invoice.pdf",
    mimeType: "application/pdf",
    bytes: file.buffer.length,
    uploadedAt: new Date(),
    uploadedBy: uploadedBy || null,
  };
}

export function resolveOrderInvoicePdfPath(invoicePdf = null) {
  const relativePath = String(invoicePdf?.storagePath || "").trim();
  if (!relativePath) return "";
  return resolveInsideMediaRoot(relativePath);
}

export function buildOrderInvoiceDownloadName(order) {
  const orderNumber = sanitizeSegment(order?.orderNumber || order?._id || "siparis", "siparis");
  return `${orderNumber}-fatura.pdf`;
}
