import {
  OFFICIAL_PHONE,
  OFFICIAL_SUPPORT_EMAIL,
} from "../config/siteContact.js";
import {
  DEFAULT_CUSTOMER_RECEIPT_CONFIG,
  normalizeCustomerReceiptConfig,
} from "./customerReceiptConfig.js";

export const CUSTOMER_PRINT_TEMPLATE = "customer_receipt_100x150";
export const SELLER_PRINT_TEMPLATE = "seller_receipt_100x150";

const LOGO_SRC = "/ceplife-logo-cropped.png";
const DEFAULT_PACKAGE_COUNT = 1;
const DEFAULT_DELIVERY_TYPE = "Adrese Teslim";
const DEFAULT_SHIPPING_PAYER = "Gonderici odeyecek";
const DEFAULT_PACKAGE_TYPE = "Standart Paket";
const DEFAULT_SITE_URL = "ceplife.com";
const DEFAULT_SMS_OPTIONS = [
  "SMS ile bilgi almak istiyorum",
  "Subede aliciya SMS gonderilsin",
  "Alici SMS ile haberlendirilsin",
];
const ORDER_STATUS_LABELS = {
  pending: "Beklemede",
  paid: "Odendi",
  shipped: "Kargoda",
  completed: "Tamamlandi",
  cancelled: "Iptal",
};
const PAYMENT_STATUS_LABELS = {
  pending: "Beklemede",
  success: "Basarili",
  failed: "Basarisiz",
  refunded: "Iade",
};
const PAYMENT_METHOD_LABELS = {
  online: "Online Odeme",
  card: "Kart",
  cod: "Kapida Odeme",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeLine(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function compactLines(values = []) {
  const seen = new Set();
  return values.filter((value) => {
    const normalized = normalizeLine(value).toLowerCase();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function toDateLabel(value, includeTime = true) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("tr-TR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(includeTime
      ? {
          hour: "2-digit",
          minute: "2-digit",
        }
      : {}),
  });
}

function splitLongText(value, maxChars = 44, maxLines = 4) {
  const normalized = normalizeLine(value);
  if (!normalized) return [];
  const words = normalized.split(" ");
  const lines = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }

  if (current) lines.push(current);
  return lines.slice(0, maxLines);
}

function splitPersonName(fullName, explicitFirstName = "", explicitLastName = "") {
  const firstName = normalizeLine(explicitFirstName);
  const lastName = normalizeLine(explicitLastName);

  if (firstName || lastName) {
    return {
      firstName: firstName || "-",
      lastName: lastName || "-",
    };
  }

  const normalized = normalizeLine(fullName);
  if (!normalized) {
    return {
      firstName: "Musteri",
      lastName: "-",
    };
  }

  const parts = normalized.split(" ").filter(Boolean);
  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: "-",
    };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function normalizeTemplate(rawTemplate) {
  const template = normalizeLine(rawTemplate);
  return template === SELLER_PRINT_TEMPLATE
    ? SELLER_PRINT_TEMPLATE
    : CUSTOMER_PRINT_TEMPLATE;
}

function formatLabelFromMap(value, labels, fallback = "-") {
  const normalized = normalizeLine(value).toLowerCase();
  if (!normalized) return fallback;
  return labels[normalized] || value || fallback;
}

function buildAddressText(address = {}) {
  const addressLineParts = compactLines([
    address.addressLine,
    [address.district, address.city].filter(Boolean).join(" / "),
    [address.postalCode, address.country].filter(Boolean).join(" "),
  ]);

  return {
    addressLineParts,
    addressText: addressLineParts.join(", ") || "-",
  };
}

function resolveCustomerIdentity(order = {}) {
  const user = order.user && typeof order.user === "object" ? order.user : null;
  const address =
    order.address && typeof order.address === "object" ? order.address : {};
  const customer =
    order.customer && typeof order.customer === "object" ? order.customer : {};
  const payment =
    order.payment && typeof order.payment === "object" ? order.payment : {};

  const customerName =
    normalizeLine(address.fullName) ||
    normalizeLine(customer.fullName) ||
    normalizeLine([user?.firstName, user?.lastName].filter(Boolean).join(" ")) ||
    "Musteri";
  const recipientName = splitPersonName(
    customerName,
    customer.firstName || user?.firstName || "",
    customer.lastName || user?.lastName || ""
  );
  const phone =
    normalizeLine(address.phone) ||
    normalizeLine(customer.phone) ||
    normalizeLine(user?.phone) ||
    "-";
  const email =
    normalizeLine(order.customerEmail) ||
    normalizeLine(customer.email) ||
    normalizeLine(user?.email) ||
    normalizeLine(payment?.payer?.email) ||
    "-";

  return {
    user,
    customer,
    address,
    customerName,
    recipientName,
    phone,
    email,
    customerTypeLabel: customer.isGuest === true ? "Misafir" : "Uyelikli",
    ...buildAddressText(address),
  };
}

function formatVariantParts(variant) {
  if (!variant || typeof variant !== "object") return [];
  const parts = [];
  if (variant.color) parts.push(`Renk: ${variant.color}`);
  if (variant.size) parts.push(`Model: ${variant.size}`);
  if (variant.attribute) parts.push(`Ozellik: ${variant.attribute}`);
  return parts;
}

export function formatOrderMoney(value) {
  const amount = Number(value || 0);
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
    }).format(amount);
  } catch {
    return `TRY ${amount.toFixed(2)}`;
  }
}

export function formatOrderDateTime(value) {
  return toDateLabel(value, true);
}

export function formatVariantSummary(variant) {
  return formatVariantParts(variant).join(" / ");
}

export function formatPrintableOrderNote(value, options = {}) {
  const maxChars = Math.max(16, Number(options.maxChars || 46) || 46);
  const maxLines = Math.max(1, Number(options.maxLines || 4) || 4);
  return splitLongText(value, maxChars, maxLines).join("\n");
}

function buildCustomerReceiptModel(order, options = {}) {
  const receiptConfig = normalizeCustomerReceiptConfig(
    options.customerReceiptConfig ||
      order.customerReceiptConfig ||
      DEFAULT_CUSTOMER_RECEIPT_CONFIG
  );
  const identity = resolveCustomerIdentity(order);
  const orderNote = formatPrintableOrderNote(order.note || "", {
    maxChars: 52,
    maxLines: 3,
  });

  return {
    template: CUSTOMER_PRINT_TEMPLATE,
    logoSrc: options.logoSrc || LOGO_SRC,
    brandName: "ceplife",
    siteUrl: options.siteUrl || DEFAULT_SITE_URL,
    supportEmail: options.supportEmail || OFFICIAL_SUPPORT_EMAIL,
    supportPhone: options.supportPhone || OFFICIAL_PHONE,
    receiptConfig,
    sloganLines: splitLongText(receiptConfig.slogan, 34, 2),
    messageLines: splitLongText(receiptConfig.message, 58, 3),
    customerName: identity.customerName,
    recipientFirstName: identity.recipientName.firstName,
    recipientLastName: identity.recipientName.lastName,
    phone: identity.phone,
    email: identity.email,
    addressLineParts: identity.addressLineParts,
    addressText: identity.addressText,
    orderNumber: normalizeLine(order.orderNumber || order.id) || "-",
    createdAtLabel: toDateLabel(order.createdAt, true),
    pickupDateLabel: toDateLabel(order.createdAt, false),
    referenceCode:
      normalizeLine(order.referenceCode || order.orderNumber || order.id) || "-",
    platformLabel: DEFAULT_SITE_URL,
    packageTypeLabel: DEFAULT_PACKAGE_TYPE,
    packageCount: Math.max(
      1,
      Number(order.packageCount || options.packageCount || DEFAULT_PACKAGE_COUNT) || 1
    ),
    deliveryTypeLabel: DEFAULT_DELIVERY_TYPE,
    shippingPayerLabel: DEFAULT_SHIPPING_PAYER,
    smsOptions: [...DEFAULT_SMS_OPTIONS],
    shippingName: normalizeLine(order.shippingName) || "Standart Kargo",
    note: orderNote,
    noteLines: orderNote ? orderNote.split("\n") : [],
    totalLabel: formatOrderMoney(order.total),
  };
}

function buildSellerDiscountLines(order = {}) {
  const pricing = order.pricing && typeof order.pricing === "object" ? order.pricing : {};
  const coupon = order.coupon && typeof order.coupon === "object" ? order.coupon : {};
  const lines = [];

  if (Number(pricing.standardDiscountAmount || 0) > 0) {
    lines.push(`Normal indirim: -${formatOrderMoney(pricing.standardDiscountAmount)}`);
  }

  if (Number(pricing.stackedDiscountAmount || 0) > 0) {
    const stackedMeta = [];
    if (Number(pricing?.stacked?.quantity || 0) > 0) {
      stackedMeta.push(`${Number(pricing.stacked.quantity || 0)}+ adet`);
    }
    if (Number(pricing?.stacked?.percentage || 0) > 0) {
      stackedMeta.push(`%${Number(pricing.stacked.percentage || 0)}`);
    }
    lines.push(
      [
        `Katlanan indirim: -${formatOrderMoney(pricing.stackedDiscountAmount)}`,
        stackedMeta.length ? `(${stackedMeta.join(" / ")})` : "",
      ]
        .filter(Boolean)
        .join(" ")
    );
  }

  if (coupon.code || Number(coupon.discountAmount || 0) > 0) {
    const couponParts = [
      `Kupon ${coupon.code || "-"}`,
      Number(coupon.percentage || 0) > 0 ? `(%${Number(coupon.percentage || 0)})` : "",
      `-${formatOrderMoney(coupon.discountAmount || 0)}`,
    ].filter(Boolean);
    lines.push(couponParts.join(" "));
  }

  return lines;
}

function buildSellerItems(items = []) {
  return (Array.isArray(items) ? items : []).map((item, index) => {
    const qty = Math.max(1, Number(item?.qty || 1) || 1);
    const unitPrice = Number(item?.unitPrice || 0) || 0;
    const originalUnitPrice = Number(item?.originalUnitPrice || 0) || 0;
    const itemPricing =
      item?.pricing && typeof item.pricing === "object" ? item.pricing : null;
    const selectionLines = (Array.isArray(item?.selections) ? item.selections : []).map(
      (selection) => {
        const selectionName =
          normalizeLine(selection?.productName) ||
          normalizeLine(selection?.productId) ||
          "Alt urun";
        const selectionVariant = formatVariantSummary(selection);
        const qtyInSet = Math.max(1, Number(selection?.qtyInSet || 1) || 1);
        return [selectionName, selectionVariant, `x${qtyInSet}`]
          .filter(Boolean)
          .join(" / ");
      }
    );

    const discountLines = [];
    if (Number(itemPricing?.standard?.amount || 0) > 0) {
      discountLines.push(
        `Normal indirim: -${formatOrderMoney(itemPricing.standard.amount)}`
      );
    }
    if (Number(itemPricing?.stacked?.amount || 0) > 0) {
      const stackedParts = [
        `Katlanan: -${formatOrderMoney(itemPricing.stacked.amount)}`,
        Number(itemPricing?.stacked?.quantity || 0) > 0
          ? `${Number(itemPricing.stacked.quantity || 0)}+ adet`
          : "",
        Number(itemPricing?.stacked?.percentage || 0) > 0
          ? `%${Number(itemPricing.stacked.percentage || 0)}`
          : "",
      ].filter(Boolean);
      discountLines.push(stackedParts.join(" / "));
    }
    if (Number(itemPricing?.coupon?.amount || 0) > 0) {
      discountLines.push(
        [
          itemPricing?.coupon?.code ? `Kupon ${itemPricing.coupon.code}` : "Kupon",
          `-${formatOrderMoney(itemPricing.coupon.amount)}`,
        ].join(" ")
      );
    }

    return {
      index: index + 1,
      kindLabel: item?.kind === "set" ? "Set" : "Urun",
      name: normalizeLine(item?.name) || "-",
      qty,
      variantSummary: formatVariantSummary(item?.variant),
      unitPriceLabel: formatOrderMoney(unitPrice),
      originalUnitPriceLabel:
        originalUnitPrice > unitPrice ? formatOrderMoney(originalUnitPrice) : "",
      lineTotalLabel: formatOrderMoney(unitPrice * qty),
      selectionLines,
      discountLines,
    };
  });
}

function buildSellerStockLines(stockUsage = []) {
  return (Array.isArray(stockUsage) ? stockUsage : []).map((entry) => {
    const name =
      normalizeLine(entry?.productName) ||
      normalizeLine(entry?.productId) ||
      "Stok";
    const variantSummary = formatVariantSummary(entry);
    const details = [
      entry?.source === "set_selection" ? "Set secimi" : "Direkt urun",
      variantSummary,
      entry?.sku ? `SKU: ${entry.sku}` : "",
      Number.isFinite(Number(entry?.qty))
        ? `Dusulen: x${Number(entry.qty || 0)}`
        : "",
      Number.isFinite(Number(entry?.previousQtyOnHand))
        ? `Onceki: ${Number(entry.previousQtyOnHand || 0)}`
        : "",
      Number.isFinite(Number(entry?.remainingQtyOnHand))
        ? `Kalan: ${Number(entry.remainingQtyOnHand || 0)}`
        : "",
    ].filter(Boolean);

    return {
      name,
      detail: details.join(" / "),
    };
  });
}

function estimateSellerDensity(model) {
  const itemLineCount = model.items.reduce((total, item) => {
    return (
      total +
      3 +
      item.selectionLines.length +
      item.discountLines.length +
      (item.variantSummary ? 1 : 0) +
      (item.originalUnitPriceLabel ? 1 : 0)
    );
  }, 0);
  const stockLineCount = model.stockLines.length * 2;
  const discountLineCount = model.discountLines.length;
  const noteLineCount = model.noteLines.length;
  const estimatedLines = 10 + itemLineCount + stockLineCount + discountLineCount + noteLineCount;

  if (estimatedLines > 34) return "dense";
  if (estimatedLines > 26) return "compact";
  return "normal";
}

function buildSellerReceiptModel(order, options = {}) {
  const identity = resolveCustomerIdentity(order);
  const payment = order.payment && typeof order.payment === "object" ? order.payment : {};
  const customer =
    order.customer && typeof order.customer === "object" ? order.customer : {};
  const accounting =
    order.accounting && typeof order.accounting === "object" ? order.accounting : {};
  const noteLines = splitLongText(order.note || "", 68, 4);
  const items = buildSellerItems(order.items);
  const stockLines = buildSellerStockLines(accounting.stockUsage);
  const model = {
    template: SELLER_PRINT_TEMPLATE,
    logoSrc: options.logoSrc || LOGO_SRC,
    brandName: "ceplife",
    siteUrl: options.siteUrl || DEFAULT_SITE_URL,
    supportEmail: options.supportEmail || OFFICIAL_SUPPORT_EMAIL,
    supportPhone: options.supportPhone || OFFICIAL_PHONE,
    orderNumber: normalizeLine(order.orderNumber || order.id) || "-",
    createdAtLabel: toDateLabel(order.createdAt, true),
    paidAtLabel: toDateLabel(payment.paidAt, true),
    orderStatusLabel: formatLabelFromMap(order.status, ORDER_STATUS_LABELS),
    paymentStatusLabel: formatLabelFromMap(payment.status, PAYMENT_STATUS_LABELS),
    paymentMethodLabel: formatLabelFromMap(
      payment.method,
      PAYMENT_METHOD_LABELS,
      normalizeLine(payment.method) || "-"
    ),
    paymentProviderLabel: normalizeLine(payment.provider) || "-",
    paymentTxnId: normalizeLine(payment.txnId) || "-",
    customerName: identity.customerName,
    customerTypeLabel: identity.customerTypeLabel,
    recipientFirstName: identity.recipientName.firstName,
    recipientLastName: identity.recipientName.lastName,
    phone: identity.phone,
    email: identity.email,
    cityLabel: compactLines([
      identity.address.district,
      identity.address.city,
      identity.address.country,
    ]).join(" / ") || "-",
    shippingName: normalizeLine(order.shippingName) || "Standart Kargo",
    shippingLabel: formatOrderMoney(order.shipping),
    subtotalLabel: formatOrderMoney(order.subtotal),
    totalLabel: formatOrderMoney(order.total),
    itemCount: items.length,
    totalQuantity: items.reduce((sum, item) => sum + item.qty, 0),
    couponCode: normalizeLine(order?.coupon?.code) || "",
    couponTemplate: normalizeLine(order?.coupon?.template) || "",
    discountLines: buildSellerDiscountLines(order),
    items,
    stockLines,
    noteLines,
    accountingApplied: accounting.stockApplied === true,
    couponConsumed: accounting.couponConsumed === true,
    customerEmail:
      normalizeLine(customer.email) || identity.email,
  };

  model.density = estimateSellerDensity(model);
  return model;
}

export function buildOrderPrintModel(order, options = {}) {
  if (!order) return null;
  const template = normalizeTemplate(options.template || order.template || "");
  return template === SELLER_PRINT_TEMPLATE
    ? buildSellerReceiptModel(order, options)
    : buildCustomerReceiptModel(order, options);
}

function buildMetaRow(label, value, extraClass = "") {
  const classes = ["meta-row", extraClass].filter(Boolean).join(" ");
  return `
    <div class="${classes}">
      <div class="meta-label">${escapeHtml(label)}</div>
      <div class="meta-value">${escapeHtml(value || "-")}</div>
    </div>
  `;
}

function buildCompactKeyValue(label, value) {
  return `
    <div class="kv-row">
      <div class="kv-label">${escapeHtml(label)}</div>
      <div class="kv-value">${escapeHtml(value || "-")}</div>
    </div>
  `;
}

function buildCustomerPrintHtml(model, options = {}) {
  const autoPrint = options.autoPrint !== false;
  const noteSection = model.note
    ? `
      <section class="panel">
        <div class="panel-title">Teslim Notu</div>
        <div class="note-block">
          ${model.noteLines.map((line) => `<div>${escapeHtml(line)}</div>`).join("")}
        </div>
      </section>
    `
    : "";

  return `<!doctype html>
  <html lang="tr">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Musteri Fisi ${escapeHtml(model.orderNumber)}</title>
      <style>
        @page { size: 100mm 150mm; margin: 0; }
        * { box-sizing: border-box; }
        html, body {
          margin: 0;
          padding: 0;
          width: 100mm;
          min-height: 150mm;
          background: #ffffff;
          color: #000000;
          font-family: Arial, Helvetica, sans-serif;
        }
        body {
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
        }
        .sheet {
          width: 100mm;
          min-height: 150mm;
          padding: 4mm;
          display: flex;
          flex-direction: column;
          gap: 2.3mm;
          background: #ffffff;
        }
        .topbar {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 2mm;
          padding-bottom: 2mm;
          border-bottom: 0.35mm solid #000000;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 2mm;
          min-width: 0;
        }
        .brand img {
          width: 24mm;
          height: auto;
          object-fit: contain;
          filter: grayscale(1) contrast(1.3);
        }
        .brand-copy {
          min-width: 0;
        }
        .brand-name {
          font-size: 3mm;
          font-weight: 800;
          text-transform: lowercase;
          letter-spacing: 0;
        }
        .brand-site {
          margin-top: 0.5mm;
          font-size: 2mm;
        }
        .order-chip {
          min-width: 28mm;
          border: 0.35mm solid #000000;
          padding: 1.7mm 2mm;
        }
        .message-box {
          border: 0.35mm solid #000000;
          padding: 2.2mm;
        }
        .message-title {
          display: flex;
          flex-direction: column;
          gap: 0.3mm;
          font-size: 2.6mm;
          font-weight: 800;
          line-height: 1.2;
        }
        .message-body {
          margin-top: 1.3mm;
          display: flex;
          flex-direction: column;
          gap: 0.5mm;
          font-size: 2.15mm;
          line-height: 1.35;
        }
        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2mm;
        }
        .panel {
          border: 0.35mm solid #000000;
          padding: 2.1mm;
          background: #ffffff;
        }
        .panel-title {
          margin-bottom: 1.6mm;
          padding-bottom: 0.8mm;
          border-bottom: 0.25mm solid #000000;
          font-size: 2.2mm;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .meta-stack {
          display: flex;
          flex-direction: column;
          gap: 1.25mm;
        }
        .meta-row {
          display: flex;
          flex-direction: column;
          gap: 0.35mm;
        }
        .meta-label {
          font-size: 1.85mm;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .meta-value {
          font-size: 2.2mm;
          line-height: 1.3;
          font-weight: 700;
          word-break: break-word;
        }
        .recipient-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5mm 2mm;
        }
        .recipient-grid .full {
          grid-column: 1 / -1;
        }
        .sms-list {
          display: flex;
          flex-direction: column;
          gap: 0.8mm;
        }
        .sms-item {
          display: flex;
          gap: 1.2mm;
          align-items: flex-start;
          font-size: 2.05mm;
          line-height: 1.28;
        }
        .sms-bullet {
          width: 2mm;
          flex: 0 0 2mm;
          text-align: center;
          font-weight: 700;
        }
        .note-block {
          display: flex;
          flex-direction: column;
          gap: 0.55mm;
          font-size: 2.05mm;
          line-height: 1.3;
        }
        .footer {
          margin-top: auto;
          border: 0.35mm solid #000000;
          padding: 2mm;
          display: flex;
          flex-direction: column;
          gap: 1mm;
        }
        .footer-line {
          display: flex;
          justify-content: space-between;
          gap: 2mm;
          align-items: center;
          font-size: 1.95mm;
          line-height: 1.3;
        }
        .footer-line strong {
          font-size: 2mm;
          font-weight: 800;
          text-transform: uppercase;
        }
        .footer-sites {
          display: flex;
          flex-direction: column;
          gap: 0.7mm;
          padding-top: 0.7mm;
          border-top: 0.25mm solid #000000;
          font-size: 1.95mm;
          line-height: 1.3;
        }
      </style>
    </head>
    <body onload="${autoPrint ? "window.print();window.close();" : ""}">
      <main class="sheet">
        <section class="topbar">
          <div class="brand">
            <img src="${escapeHtml(model.logoSrc)}" alt="ceplife" />
            <div class="brand-copy">
              <div class="brand-name">${escapeHtml(model.brandName)}</div>
              <div class="brand-site">${escapeHtml(model.siteUrl)}</div>
            </div>
          </div>
          <div class="order-chip">
            <div class="meta-label">Siparis No</div>
            <div class="meta-value">${escapeHtml(model.orderNumber)}</div>
          </div>
        </section>

        <section class="message-box">
          <div class="message-title">
            ${model.sloganLines.map((line) => `<div>${escapeHtml(line)}</div>`).join("")}
          </div>
          <div class="message-body">
            ${model.messageLines.map((line) => `<div>${escapeHtml(line)}</div>`).join("")}
          </div>
        </section>

        <section class="grid">
          <div class="panel">
            <div class="panel-title">Takip Bilgileri</div>
            <div class="meta-stack">
              ${buildMetaRow("Siparis No", model.orderNumber)}
              ${buildMetaRow("Referans Kodu", model.referenceCode)}
              ${buildMetaRow("Olusturma", model.createdAtLabel)}
              ${buildMetaRow("Alim Tarihi", model.pickupDateLabel)}
            </div>
          </div>
          <div class="panel">
            <div class="panel-title">Diger Secenekler</div>
            <div class="meta-stack">
              ${buildMetaRow("Teslim Sekli", model.deliveryTypeLabel)}
              ${buildMetaRow("Odeme Sekli", model.shippingPayerLabel)}
              <div class="meta-row">
                <div class="meta-label">SMS Secenekleri</div>
                <div class="sms-list">
                  ${model.smsOptions
                    .map(
                      (item) => `
                        <div class="sms-item">
                          <div class="sms-bullet">*</div>
                          <div>${escapeHtml(item)}</div>
                        </div>
                      `
                    )
                    .join("")}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-title">Alici Bilgileri</div>
          <div class="recipient-grid">
            ${buildMetaRow("Alici Adi", model.recipientFirstName)}
            ${buildMetaRow("Alici Soyadi", model.recipientLastName)}
            ${buildMetaRow("Cep Telefonu", model.phone)}
            ${buildMetaRow("E-posta", model.email)}
            ${buildMetaRow("Teslimat Adresi", model.addressText, "full")}
          </div>
        </section>

        ${noteSection}

        <section class="footer">
          <div class="footer-line">
            <strong>E-posta</strong>
            <span>${escapeHtml(model.supportEmail)}</span>
          </div>
          <div class="footer-line">
            <strong>Telefon</strong>
            <span>${escapeHtml(model.supportPhone)}</span>
          </div>
          <div class="footer-sites">
            <div>Instagram: ${escapeHtml(model.receiptConfig.instagramUrl)}</div>
            <div>TikTok: ${escapeHtml(model.receiptConfig.tiktokUrl)}</div>
          </div>
        </section>
      </main>
    </body>
  </html>`;
}

function buildSellerPrintHtml(model, options = {}) {
  const autoPrint = options.autoPrint !== false;
  const discountSection = model.discountLines.length
    ? `
      <section class="section">
        <div class="section-title">Indirimler</div>
        <div class="mini-list">
          ${model.discountLines
            .map((line) => `<div class="mini-item">${escapeHtml(line)}</div>`)
            .join("")}
        </div>
      </section>
    `
    : "";

  const stockSection = model.stockLines.length
    ? `
      <section class="section">
        <div class="section-title">Stok Hareketi</div>
        <div class="mini-list">
          ${model.stockLines
            .map(
              (line) => `
                <div class="stock-item">
                  <div class="stock-name">${escapeHtml(line.name)}</div>
                  <div class="stock-detail">${escapeHtml(line.detail)}</div>
                </div>
              `
            )
            .join("")}
        </div>
      </section>
    `
    : "";

  const noteSection = model.noteLines.length
    ? `
      <section class="section">
        <div class="section-title">Siparis Notu</div>
        <div class="mini-list">
          ${model.noteLines
            .map((line) => `<div class="mini-item">${escapeHtml(line)}</div>`)
            .join("")}
        </div>
      </section>
    `
    : "";

  return `<!doctype html>
  <html lang="tr">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Satici Fisi ${escapeHtml(model.orderNumber)}</title>
      <style>
        @page { size: 100mm 150mm; margin: 0; }
        * { box-sizing: border-box; }
        html, body {
          margin: 0;
          padding: 0;
          width: 100mm;
          min-height: 150mm;
          background: #ffffff;
          color: #000000;
          font-family: Arial, Helvetica, sans-serif;
        }
        body {
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
        }
        .sheet {
          width: 100mm;
          min-height: 150mm;
          padding: 3.1mm;
          display: flex;
          flex-direction: column;
          gap: 1.6mm;
          background: #ffffff;
        }
        .sheet.compact {
          padding: 2.8mm;
          gap: 1.35mm;
        }
        .sheet.dense {
          padding: 2.5mm;
          gap: 1.1mm;
        }
        .topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 2mm;
          padding-bottom: 1.6mm;
          border-bottom: 0.32mm solid #000000;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 2mm;
          min-width: 0;
        }
        .brand img {
          width: 21mm;
          height: auto;
          object-fit: contain;
          filter: grayscale(1) contrast(1.35);
        }
        .brand-copy {
          min-width: 0;
        }
        .brand-title {
          font-size: 3mm;
          font-weight: 800;
          line-height: 1.15;
        }
        .brand-subtitle {
          margin-top: 0.5mm;
          font-size: 1.95mm;
          line-height: 1.2;
        }
        .sheet.compact .brand-title {
          font-size: 2.8mm;
        }
        .sheet.dense .brand-title {
          font-size: 2.5mm;
        }
        .order-chip {
          min-width: 27mm;
          padding: 1.4mm 1.8mm;
          border: 0.32mm solid #000000;
          text-align: right;
        }
        .chip-label {
          font-size: 1.65mm;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .chip-value {
          margin-top: 0.4mm;
          font-size: 2.25mm;
          font-weight: 800;
          line-height: 1.2;
          word-break: break-word;
        }
        .summary-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5mm;
        }
        .section {
          border: 0.32mm solid #000000;
          padding: 1.7mm;
          background: #ffffff;
        }
        .sheet.compact .section {
          padding: 1.45mm;
        }
        .sheet.dense .section {
          padding: 1.2mm;
        }
        .section-title {
          margin-bottom: 1.1mm;
          padding-bottom: 0.55mm;
          border-bottom: 0.2mm solid #000000;
          font-size: 1.95mm;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .kv-row {
          display: flex;
          justify-content: space-between;
          gap: 1.4mm;
          align-items: flex-start;
          padding: 0.25mm 0;
        }
        .kv-label,
        .kv-value {
          font-size: 1.8mm;
          line-height: 1.25;
        }
        .sheet.compact .kv-label,
        .sheet.compact .kv-value {
          font-size: 1.7mm;
        }
        .sheet.dense .kv-label,
        .sheet.dense .kv-value {
          font-size: 1.58mm;
        }
        .kv-label {
          font-weight: 700;
          min-width: 17mm;
        }
        .kv-value {
          flex: 1 1 auto;
          text-align: right;
          word-break: break-word;
        }
        .mini-list {
          display: flex;
          flex-direction: column;
          gap: 0.7mm;
        }
        .sheet.compact .mini-list {
          gap: 0.55mm;
        }
        .sheet.dense .mini-list {
          gap: 0.42mm;
        }
        .mini-item,
        .stock-name,
        .stock-detail,
        .item-title,
        .item-sub {
          word-break: break-word;
        }
        .mini-item,
        .stock-detail,
        .item-sub {
          font-size: 1.78mm;
          line-height: 1.26;
        }
        .sheet.compact .mini-item,
        .sheet.compact .stock-detail,
        .sheet.compact .item-sub {
          font-size: 1.68mm;
        }
        .sheet.dense .mini-item,
        .sheet.dense .stock-detail,
        .sheet.dense .item-sub {
          font-size: 1.52mm;
        }
        .item-card {
          border-bottom: 0.18mm dashed #000000;
          padding-bottom: 0.85mm;
        }
        .item-card:last-child {
          border-bottom: 0;
          padding-bottom: 0;
        }
        .item-head {
          display: flex;
          justify-content: space-between;
          gap: 1.4mm;
          align-items: flex-start;
        }
        .item-title {
          flex: 1 1 auto;
          font-size: 1.92mm;
          font-weight: 800;
          line-height: 1.22;
        }
        .sheet.compact .item-title {
          font-size: 1.78mm;
        }
        .sheet.dense .item-title {
          font-size: 1.62mm;
        }
        .item-total {
          flex: 0 0 auto;
          font-size: 1.82mm;
          font-weight: 800;
          line-height: 1.2;
        }
        .sheet.compact .item-total {
          font-size: 1.7mm;
        }
        .sheet.dense .item-total {
          font-size: 1.56mm;
        }
        .sub-list {
          margin-top: 0.45mm;
          display: flex;
          flex-direction: column;
          gap: 0.28mm;
          padding-left: 1.3mm;
        }
        .sub-item::before {
          content: "- ";
        }
        .stock-item {
          display: flex;
          flex-direction: column;
          gap: 0.22mm;
        }
        .stock-name {
          font-size: 1.82mm;
          font-weight: 800;
          line-height: 1.2;
        }
        .sheet.compact .stock-name {
          font-size: 1.72mm;
        }
        .sheet.dense .stock-name {
          font-size: 1.58mm;
        }
        .footer {
          margin-top: auto;
          border: 0.32mm solid #000000;
          padding: 1.55mm;
          display: flex;
          justify-content: space-between;
          gap: 2mm;
          align-items: center;
        }
        .footer-line {
          font-size: 1.65mm;
          line-height: 1.2;
        }
        .footer-right {
          text-align: right;
          font-size: 1.65mm;
          line-height: 1.2;
        }
      </style>
    </head>
    <body onload="${autoPrint ? "window.print();window.close();" : ""}">
      <main class="sheet ${escapeHtml(model.density)}">
        <section class="topbar">
          <div class="brand">
            <img src="${escapeHtml(model.logoSrc)}" alt="ceplife" />
            <div class="brand-copy">
              <div class="brand-title">Satici Fisi</div>
              <div class="brand-subtitle">${escapeHtml(model.brandName)} / ${escapeHtml(
                model.siteUrl
              )}</div>
            </div>
          </div>
          <div class="order-chip">
            <div class="chip-label">Siparis No</div>
            <div class="chip-value">${escapeHtml(model.orderNumber)}</div>
          </div>
        </section>

        <section class="summary-grid">
          <div class="section">
            <div class="section-title">Musteri</div>
            ${buildCompactKeyValue("Ad Soyad", model.customerName)}
            ${buildCompactKeyValue("Tip", model.customerTypeLabel)}
            ${buildCompactKeyValue("Telefon", model.phone)}
            ${buildCompactKeyValue("E-posta", model.email)}
            ${buildCompactKeyValue("Bolge", model.cityLabel)}
          </div>
          <div class="section">
            <div class="section-title">Odeme</div>
            ${buildCompactKeyValue("Durum", model.orderStatusLabel)}
            ${buildCompactKeyValue("Odeme", model.paymentMethodLabel)}
            ${buildCompactKeyValue("Odeme Durumu", model.paymentStatusLabel)}
            ${buildCompactKeyValue("Toplam", model.totalLabel)}
            ${buildCompactKeyValue("Kargo", `${model.shippingName} / ${model.shippingLabel}`)}
          </div>
        </section>

        <section class="section">
          <div class="section-title">Siparis Ozeti</div>
          ${buildCompactKeyValue("Olusturma", model.createdAtLabel)}
          ${buildCompactKeyValue("Tahsilat", model.paidAtLabel)}
          ${buildCompactKeyValue("Kalem", `${model.itemCount} kalem / ${model.totalQuantity} adet`)}
          ${buildCompactKeyValue("Ara Toplam", model.subtotalLabel)}
          ${buildCompactKeyValue("Provider", model.paymentProviderLabel)}
          ${buildCompactKeyValue("Txn", model.paymentTxnId)}
        </section>

        ${discountSection}

        <section class="section">
          <div class="section-title">Siparis Kalemleri</div>
          <div class="mini-list">
            ${model.items
              .map(
                (item) => `
                  <div class="item-card">
                    <div class="item-head">
                      <div class="item-title">${escapeHtml(
                        `${item.index}. ${item.kindLabel} x${item.qty} - ${item.name}`
                      )}</div>
                      <div class="item-total">${escapeHtml(item.lineTotalLabel)}</div>
                    </div>
                    ${item.variantSummary ? `<div class="item-sub">${escapeHtml(item.variantSummary)}</div>` : ""}
                    <div class="item-sub">Birim: ${escapeHtml(item.unitPriceLabel)}</div>
                    ${
                      item.originalUnitPriceLabel
                        ? `<div class="item-sub">Liste: ${escapeHtml(item.originalUnitPriceLabel)}</div>`
                        : ""
                    }
                    ${item.discountLines
                      .map((line) => `<div class="item-sub">${escapeHtml(line)}</div>`)
                      .join("")}
                    ${
                      item.selectionLines.length
                        ? `
                          <div class="sub-list">
                            ${item.selectionLines
                              .map(
                                (line) =>
                                  `<div class="item-sub sub-item">${escapeHtml(line)}</div>`
                              )
                              .join("")}
                          </div>
                        `
                        : ""
                    }
                  </div>
                `
              )
              .join("")}
          </div>
        </section>

        ${stockSection}
        ${noteSection}

        <section class="footer">
          <div class="footer-line">
            Stok uygulandi: ${escapeHtml(model.accountingApplied ? "Evet" : "Hayir")}<br />
            Kupon dusuldu: ${escapeHtml(model.couponConsumed ? "Evet" : "Hayir")}
          </div>
          <div class="footer-right">
            ${escapeHtml(model.supportPhone)}<br />
            ${escapeHtml(model.supportEmail)}
          </div>
        </section>
      </main>
    </body>
  </html>`;
}

export function buildOrderPrintHtml(model, options = {}) {
  if (!model) return "";
  return model.template === SELLER_PRINT_TEMPLATE
    ? buildSellerPrintHtml(model, options)
    : buildCustomerPrintHtml(model, options);
}
