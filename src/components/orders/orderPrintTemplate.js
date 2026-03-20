import {
  buildAdaptiveOrderPrintLayout,
  ORDER_PRINT_LAYOUT_PROFILES,
  wrapPrintableTextLines,
} from "../../utils/orderPrintLayout.js";
const LOGO_SRC = "/logo.png";

export function formatOrderMoney(value) {
  const amount = Number(value || 0);
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
    }).format(amount);
  } catch {
    return `₺${amount.toFixed(2)}`;
  }
}

export function formatOrderDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("tr-TR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatVariantSummary(variant) {
  if (!variant || typeof variant !== "object") return "";
  const parts = [];
  if (variant.color) parts.push(`Renk: ${variant.color}`);
  if (variant.size) parts.push(`Model: ${variant.size}`);
  if (variant.attribute) parts.push(`Özellik: ${variant.attribute}`);
  return parts.join(" • ");
}

function formatSelectionSummary(selection, index) {
  const parts = [];
  if (selection.qtyInSet) parts.push(`${selection.qtyInSet}x`);
  const variantText = formatVariantSummary(selection);
  if (variantText) {
    parts.push(variantText);
  } else {
    parts.push(`Set seçimi ${index + 1}`);
  }
  return parts.join(" ");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildDensityCssRules() {
  return ORDER_PRINT_LAYOUT_PROFILES.map((profile) => {
    const html = profile.html || {};
    return `
      .sheet[data-density="${profile.key}"] {
        --sheet-padding: ${html.sheetPadding};
        --sheet-gap: ${html.sheetGap};
        --section-padding-y: ${html.sectionPaddingY};
        --section-padding-x: ${html.sectionPaddingX};
        --section-title-font-size: ${html.sectionTitleFontSize};
        --section-title-margin-bottom: ${html.sectionTitleMarginBottom};
        --customer-name-font-size: ${html.customerNameFontSize};
        --customer-name-gap: ${html.customerNameGap};
        --customer-phone-font-size: ${html.customerPhoneFontSize};
        --address-font-size: ${html.addressFontSize};
        --address-line-height: ${html.addressLineHeight};
        --items-gap: ${html.itemsGap};
        --item-row-gap: ${html.itemRowGap};
        --item-row-padding-bottom: ${html.itemRowPaddingBottom};
        --item-name-font-size: ${html.itemNameFontSize};
        --item-name-line-height: ${html.itemNameLineHeight};
        --item-meta-gap: ${html.itemMetaGap};
        --item-meta-font-size: ${html.itemMetaFontSize};
        --item-sub-font-size: ${html.itemSubFontSize};
        --item-sub-line-height: ${html.itemSubLineHeight};
        --item-total-font-size: ${html.itemTotalFontSize};
        --totals-gap: ${html.totalsGap};
        --total-font-size: ${html.totalFontSize};
        --total-strong-font-size: ${html.totalStrongFontSize};
        --note-font-size: ${html.noteFontSize};
        --note-line-height: ${html.noteLineHeight};
        --note-max-height: ${html.noteMaxHeight};
      }
    `;
  }).join("\n");
}

export function formatPrintableOrderNote(value, options = {}) {
  const maxChars = Math.max(8, Number(options.maxChars || 36) || 36);
  const maxLines = Math.max(1, Number(options.maxLines || 4) || 4);
  return wrapPrintableTextLines(value, maxChars, maxLines).join("\n");
}

export function buildOrderPrintModel(order, options = {}) {
  if (!order) return null;

  const address = order.address || {};
  const user = order.user && typeof order.user === "object" ? order.user : null;
  const items = Array.isArray(order.items)
    ? order.items.map((item, index) => ({
        id: item.ref || `${index}`,
        name: item.name || `Ürün ${index + 1}`,
        qty: Number(item.qty || 0) || 1,
        qtyLabel: `${Number(item.qty || 0) || 1} adet`,
        unitPriceLabel: formatOrderMoney(item.unitPrice),
        lineTotalLabel: formatOrderMoney(
          (Number(item.unitPrice || 0) || 0) * (Number(item.qty || 0) || 1)
        ),
        variantSummary: formatVariantSummary(item.variant),
        selectionLines: Array.isArray(item.selections)
          ? item.selections.map(formatSelectionSummary)
          : [],
      }))
    : [];

  const addressLineParts = [
    address.addressLine || "",
    [address.city, address.district].filter(Boolean).join(" / "),
    [address.postalCode, address.country].filter(Boolean).join(" "),
  ].filter(Boolean);
  const baseSubtotal = Number(order?.pricing?.baseSubtotal || 0);
  const subtotalForPrint =
    baseSubtotal > 0 ? baseSubtotal : Number(order?.subtotal || 0);
  const customerName =
    address.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    "-";
  const layout = buildAdaptiveOrderPrintLayout({
    customerName,
    addressLines: addressLineParts,
    note: order.note || "",
    items,
  });
  const printableItems = Array.isArray(layout.items) ? layout.items : items;

  return {
    logoSrc: options.logoSrc || LOGO_SRC,
    orderNumber: order.orderNumber || order.id || "-",
    createdAtLabel: formatOrderDateTime(order.createdAt),
    customerName,
    customerNameLines: layout.customerNameLines,
    phone: address.phone || user?.phone || "-",
    addressLineParts: layout.addressLines,
    items: printableItems,
    itemCount: items.reduce((sum, item) => sum + item.qty, 0),
    subtotalLabel: formatOrderMoney(subtotalForPrint),
    adjustments: [
      Number(order?.pricing?.standardDiscountAmount || 0) > 0
        ? {
            label: "Normal Ind.",
            valueLabel: `- ${formatOrderMoney(
              order.pricing.standardDiscountAmount
            )}`,
          }
        : null,
      Number(order?.pricing?.stackedDiscountAmount || 0) > 0
        ? {
            label:
              Number(order?.pricing?.stacked?.percentage || 0) > 0
                ? `Katlanan %${order.pricing.stacked.percentage}`
                : "Katlanan Ind.",
            valueLabel: `- ${formatOrderMoney(
              order.pricing.stackedDiscountAmount
            )}`,
          }
        : null,
      Number(order?.coupon?.discountAmount || 0) > 0
        ? {
            label: order?.coupon?.code ? `Kupon ${order.coupon.code}` : "Kupon",
            valueLabel: `- ${formatOrderMoney(order.coupon.discountAmount)}`,
          }
        : null,
    ].filter(Boolean),
    shippingLabel: formatOrderMoney(order.shipping),
    shippingName: order.shippingName || "Kargo",
    totalLabel: formatOrderMoney(order.total),
    note: layout.note || formatPrintableOrderNote(order.note),
    noteLines: layout.noteLines || [],
    layout: {
      key: layout.key,
      profile: layout.profile || null,
      hiddenItemCount: layout.hiddenItemCount || 0,
      hiddenQty: layout.hiddenQty || 0,
      metrics: layout.metrics || {},
    },
  };
}

export function buildOrderPrintHtml(model, options = {}) {
  if (!model) return "";
  const autoPrint = options.autoPrint !== false;
  const imageMode = options.imageMode === true;

  const itemsHtml = model.items
    .map((item) => {
      const itemMetaLines = Array.isArray(item.metaLines)
        ? item.metaLines
        : [
            [String(item.qty || 0), "adet", item.unitPriceLabel]
              .filter(Boolean)
              .join(" "),
            item.variantSummary,
            ...(Array.isArray(item.selectionLines) ? item.selectionLines : []),
          ].filter(Boolean);
      const selectionHtml = itemMetaLines.length
        ? `
          <div class="item-selections">
            ${itemMetaLines
              .map((line) => `<div class="item-subline">${escapeHtml(line)}</div>`)
              .join("")}
          </div>
        `
        : "";
      const itemNameLines = Array.isArray(item.nameLines)
        ? item.nameLines
        : [item.name].filter(Boolean);
      const totalHtml = item.lineTotalLabel
        ? `<div class="item-total">${escapeHtml(item.lineTotalLabel)}</div>`
        : "";
      const rowClass = item.isOverflowSummary
        ? "item-row item-row-overflow"
        : "item-row";

      return `
        <div class="${rowClass}">
          <div class="item-main">
            <div class="item-name">
              ${itemNameLines
                .map((line) => `<div>${escapeHtml(line)}</div>`)
                .join("")}
            </div>
            ${selectionHtml}
          </div>
          ${totalHtml}
        </div>
      `;
    })
    .join("");

  const noteHtml = model.note
    ? `
      <div class="section">
        <div class="section-title">Sipariş Notu</div>
        <div class="note-box">${escapeHtml(model.note)}</div>
      </div>
    `
    : "";

  const adjustmentHtml = Array.isArray(model.adjustments)
    ? model.adjustments
        .map(
          (adjustment) => `
            <div class="total-row total-row-discount">
              <span>${escapeHtml(adjustment.label)}</span>
              <span>${escapeHtml(adjustment.valueLabel)}</span>
            </div>
          `
        )
        .join("")
    : "";

  return `<!doctype html>
  <html lang="tr">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Sipariş Etiketi ${escapeHtml(model.orderNumber)}</title>
      <style>
        @page {
          size: 100mm 150mm;
          margin: 0;
        }
        * {
          box-sizing: border-box;
        }
        html, body {
          margin: 0;
          padding: 0;
          font-family: Arial, Helvetica, sans-serif;
          color: #221c17;
          width: 100mm;
          height: 150mm;
          overflow: hidden;
          background: ${imageMode ? "#ffffff" : "#f3efe7"};
        }
        body {
          ${imageMode ? "display: block; padding: 0;" : "min-height: 100vh; display: grid; place-items: center; padding: 8px;"}
        }
        .sheet {
          width: 100mm;
          height: 150mm;
          background: #ffffff;
          padding: var(--sheet-padding);
          display: flex;
          flex-direction: column;
          gap: var(--sheet-gap);
          overflow: hidden;
        }
        .sheet-content {
          min-height: 0;
          display: flex;
          flex-direction: column;
          gap: inherit;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 3mm;
          border-bottom: 0.4mm solid #1f2937;
          padding-bottom: 2.4mm;
        }
        .brand {
          display: flex;
          flex-direction: column;
          gap: 1.4mm;
        }
        .brand img {
          width: 21mm;
          height: auto;
          object-fit: contain;
        }
        .eyebrow {
          font-size: 2.35mm;
          text-transform: uppercase;
          letter-spacing: 0.24mm;
          color: #6b7280;
        }
        .order-number {
          font-size: 4.4mm;
          font-weight: 700;
        }
        .date {
          font-size: 2.55mm;
          color: #4b5563;
        }
        .section {
          border: 0.3mm solid #d6d3d1;
          border-radius: 2mm;
          padding: var(--section-padding-y) var(--section-padding-x);
          min-height: 0;
        }
        .section-title {
          font-size: var(--section-title-font-size);
          text-transform: uppercase;
          letter-spacing: 0.18mm;
          color: #6b7280;
          margin-bottom: var(--section-title-margin-bottom);
        }
        .customer-name {
          font-size: var(--customer-name-font-size);
          font-weight: 700;
          display: grid;
          gap: var(--customer-name-gap);
          margin-bottom: 0.7mm;
        }
        .customer-phone {
          font-size: var(--customer-phone-font-size);
        }
        .address-line {
          font-size: var(--address-font-size);
          line-height: var(--address-line-height);
        }
        .items {
          display: flex;
          flex-direction: column;
          gap: var(--items-gap);
          min-height: 0;
        }
        .item-row {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: var(--item-row-gap);
          align-items: start;
          border-bottom: 0.25mm dashed #d6d3d1;
          padding-bottom: var(--item-row-padding-bottom);
        }
        .item-row:last-child {
          border-bottom: 0;
          padding-bottom: 0;
        }
        .item-row-overflow {
          background: #fafaf9;
          border-radius: 1.4mm;
          padding: 1.2mm 1.4mm;
          border-bottom: 0;
        }
        .item-name {
          font-size: var(--item-name-font-size);
          font-weight: 700;
          line-height: var(--item-name-line-height);
        }
        .item-selections {
          margin-top: var(--item-meta-gap);
          display: grid;
          gap: var(--item-meta-gap);
        }
        .item-subline {
          font-size: var(--item-sub-font-size);
          color: #6b7280;
          line-height: var(--item-sub-line-height);
        }
        .item-total {
          font-size: var(--item-total-font-size);
          font-weight: 700;
          white-space: nowrap;
        }
        .totals {
          display: grid;
          gap: var(--totals-gap);
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          gap: 2mm;
          font-size: var(--total-font-size);
        }
        .total-row-discount {
          color: #b45309;
        }
        .total-row strong {
          font-size: var(--total-strong-font-size);
        }
        .note-box {
          font-size: var(--note-font-size);
          line-height: var(--note-line-height);
          white-space: pre-wrap;
          word-break: break-word;
          max-height: var(--note-max-height);
          overflow: hidden;
        }
        ${buildDensityCssRules()}
        @media print {
          html, body {
            width: 100mm;
            height: 150mm;
          }
          body {
            display: block;
            min-height: 0;
            padding: 0;
            background: #fff;
          }
          .sheet {
            width: 100mm;
            height: 150mm;
            page-break-after: avoid;
          }
        }
      </style>
    </head>
    <body>
      <main class="sheet" data-density="${escapeHtml(
        model?.layout?.key || "regular"
      )}">
        <div class="sheet-content">
        <header class="header">
          <div class="brand">
            <div class="eyebrow">Kutu Etiketi</div>
            <img src="${escapeHtml(model.logoSrc)}" alt="Logo" />
          </div>
          <div>
            <div class="order-number">${escapeHtml(model.orderNumber)}</div>
            <div class="date">${escapeHtml(model.createdAtLabel)}</div>
          </div>
        </header>

        <section class="section">
          <div class="section-title">Alıcı</div>
          <div class="customer-name">
            ${(Array.isArray(model.customerNameLines)
              ? model.customerNameLines
              : [model.customerName]
            )
              .map((line) => `<div>${escapeHtml(line)}</div>`)
              .join("")}
          </div>
          <div class="customer-phone">${escapeHtml(model.phone)}</div>
        </section>

        <section class="section">
          <div class="section-title">Adres</div>
          ${model.addressLineParts
            .map(
              (line) => `<div class="address-line">${escapeHtml(line)}</div>`
            )
            .join("")}
        </section>

        <section class="section">
          <div class="section-title">Ürünler (${escapeHtml(
            String(model.itemCount)
          )})</div>
          <div class="items">${itemsHtml}</div>
        </section>

        <section class="section">
          <div class="section-title">Toplamlar</div>
          <div class="totals">
            <div class="total-row">
              <span>Ara Toplam</span>
              <span>${escapeHtml(model.subtotalLabel)}</span>
            </div>
            ${adjustmentHtml}
            <div class="total-row">
              <span>${escapeHtml(model.shippingName)}</span>
              <span>${escapeHtml(model.shippingLabel)}</span>
            </div>
            <div class="total-row">
              <strong>Genel Toplam</strong>
              <strong>${escapeHtml(model.totalLabel)}</strong>
            </div>
          </div>
        </section>

        ${noteHtml}
        </div>
      </main>

      ${
        autoPrint
          ? `
      <script>
        const densityOrder = ["regular", "compact", "tight", "micro"];
        const waitForImages = async () => {
          const images = Array.from(document.images);
          if (!images.length) return;
          await Promise.all(
            images.map((image) =>
              image.complete
                ? Promise.resolve()
                : new Promise((resolve) => {
                    image.addEventListener("load", resolve, { once: true });
                    image.addEventListener("error", resolve, { once: true });
                  })
            )
          );
        };

        const fitSheet = () => {
          const sheet = document.querySelector(".sheet");
          const content = document.querySelector(".sheet-content");
          if (!sheet || !content) return;
          let index = Math.max(
            0,
            densityOrder.indexOf(sheet.dataset.density || "regular")
          );
          while (
            index < densityOrder.length - 1 &&
            content.scrollHeight > sheet.clientHeight + 2
          ) {
            index += 1;
            sheet.dataset.density = densityOrder[index];
          }
        };

        waitForImages().then(() => {
          fitSheet();
          setTimeout(() => {
            window.focus();
            window.print();
          }, 180);
        });

        window.onafterprint = () => {
          window.close();
        };
      </script>`
          : ""
      }
    </body>
  </html>`;
}
