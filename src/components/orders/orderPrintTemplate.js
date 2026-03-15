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
  if (variant.size) parts.push(`Beden: ${variant.size}`);
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

export function buildOrderPrintModel(order, options = {}) {
  if (!order) return null;

  const address = order.address || {};
  const user = order.user && typeof order.user === "object" ? order.user : null;
  const items = Array.isArray(order.items)
    ? order.items.map((item, index) => ({
        id: item.ref || `${index}`,
        name: item.name || `Ürün ${index + 1}`,
        qty: Number(item.qty || 0) || 1,
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

  return {
    logoSrc: options.logoSrc || LOGO_SRC,
    orderNumber: order.orderNumber || order.id || "-",
    createdAtLabel: formatOrderDateTime(order.createdAt),
    customerName:
      address.fullName ||
      [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
      "-",
    phone: address.phone || user?.phone || "-",
    addressLineParts,
    items,
    itemCount: items.reduce((sum, item) => sum + item.qty, 0),
    subtotalLabel: formatOrderMoney(order.subtotal),
    shippingLabel: formatOrderMoney(order.shipping),
    shippingName: order.shippingName || "Kargo",
    totalLabel: formatOrderMoney(order.total),
    note: String(order.note || "").trim(),
  };
}

export function buildOrderPrintHtml(model, options = {}) {
  if (!model) return "";
  const autoPrint = options.autoPrint !== false;
  const imageMode = options.imageMode === true;

  const itemsHtml = model.items
    .map((item) => {
      const selectionHtml = item.selectionLines.length
        ? `
          <div class="item-selections">
            ${item.selectionLines
              .map((line) => `<div class="item-subline">${escapeHtml(line)}</div>`)
              .join("")}
          </div>
        `
        : "";

      return `
        <div class="item-row">
          <div class="item-main">
            <div class="item-name">${escapeHtml(item.name)}</div>
            <div class="item-meta">
              <span>${escapeHtml(String(item.qty))} adet</span>
              <span>${escapeHtml(item.unitPriceLabel)}</span>
            </div>
            ${
              item.variantSummary
                ? `<div class="item-subline">${escapeHtml(item.variantSummary)}</div>`
                : ""
            }
            ${selectionHtml}
          </div>
          <div class="item-total">${escapeHtml(item.lineTotalLabel)}</div>
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
          padding: 4.5mm;
          display: flex;
          flex-direction: column;
          gap: 2.4mm;
          overflow: hidden;
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
          padding: 2.2mm 2.5mm;
        }
        .section-title {
          font-size: 2.3mm;
          text-transform: uppercase;
          letter-spacing: 0.18mm;
          color: #6b7280;
          margin-bottom: 1.2mm;
        }
        .customer-name {
          font-size: 3.45mm;
          font-weight: 700;
          margin-bottom: 0.7mm;
        }
        .customer-phone {
          font-size: 2.95mm;
        }
        .address-line {
          font-size: 2.82mm;
          line-height: 1.28;
        }
        .items {
          display: flex;
          flex-direction: column;
          gap: 1.7mm;
        }
        .item-row {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 2mm;
          align-items: start;
          border-bottom: 0.25mm dashed #d6d3d1;
          padding-bottom: 1.5mm;
        }
        .item-row:last-child {
          border-bottom: 0;
          padding-bottom: 0;
        }
        .item-name {
          font-size: 2.9mm;
          font-weight: 700;
          line-height: 1.22;
        }
        .item-meta {
          margin-top: 0.5mm;
          display: flex;
          gap: 1.3mm;
          flex-wrap: wrap;
          font-size: 2.45mm;
          color: #4b5563;
        }
        .item-subline {
          margin-top: 0.45mm;
          font-size: 2.35mm;
          color: #6b7280;
          line-height: 1.2;
        }
        .item-total {
          font-size: 2.7mm;
          font-weight: 700;
          white-space: nowrap;
        }
        .totals {
          display: grid;
          gap: 0.85mm;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          gap: 2mm;
          font-size: 2.7mm;
        }
        .total-row strong {
          font-size: 3.15mm;
        }
        .note-box {
          font-size: 2.55mm;
          line-height: 1.24;
          white-space: pre-wrap;
          word-break: break-word;
        }
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
      <main class="sheet">
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
          <div class="customer-name">${escapeHtml(model.customerName)}</div>
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
      </main>

      ${
        autoPrint
          ? `
      <script>
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

        waitForImages().then(() => {
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
