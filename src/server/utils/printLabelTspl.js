import {
  buildAdaptiveOrderPrintLayout,
  getOrderPrintLayoutProfile,
} from "../../utils/orderPrintLayout.js";

const DOTS_PER_MM = 8;
const LABEL_WIDTH_MM = 100;
const LABEL_HEIGHT_MM = 150;
const DEFAULT_GAP_MM = Math.max(1, Number(process.env.PRINT_LABEL_GAP_MM || 3));

function mm(value) {
  return Math.round(Number(value || 0) * DOTS_PER_MM);
}

function roundCurrency(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function formatMoney(value) {
  return `${roundCurrency(value).toFixed(2)} TL`;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("tr-TR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function transliterate(value) {
  return String(value ?? "")
    .replaceAll("İ", "I")
    .replaceAll("İ", "I")
    .replaceAll("ı", "i")
    .replaceAll("Ş", "S")
    .replaceAll("ş", "s")
    .replaceAll("Ğ", "G")
    .replaceAll("ğ", "g")
    .replaceAll("Ü", "U")
    .replaceAll("ü", "u")
    .replaceAll("Ö", "O")
    .replaceAll("ö", "o")
    .replaceAll("Ç", "C")
    .replaceAll("ç", "c")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, " ");
}

function sanitizeLine(value) {
  return transliterate(value).replace(/\s+/g, " ").trim();
}

function escapeTspl(value) {
  return sanitizeLine(value).replaceAll('"', "'");
}

function wrapText(value, maxChars) {
  const normalized = sanitizeLine(value);
  if (!normalized) return [];
  const words = normalized.split(" ");
  const lines = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    if (word.length <= maxChars) {
      current = word;
      continue;
    }
    let remaining = word;
    while (remaining.length > maxChars) {
      lines.push(remaining.slice(0, maxChars));
      remaining = remaining.slice(maxChars);
    }
    current = remaining;
  }

  if (current) lines.push(current);
  return lines;
}

function variantSummary(variant = null) {
  if (!variant || typeof variant !== "object") return "";
  const parts = [];
  if (variant.color) parts.push(`Renk ${variant.color}`);
  if (variant.size) parts.push(`Model ${variant.size}`);
  if (variant.attribute) parts.push(`Ozellik ${variant.attribute}`);
  return parts.join(" / ");
}

function selectionSummary(selection, index) {
  const parts = [];
  if (selection?.qtyInSet) parts.push(`${selection.qtyInSet}x`);
  const variant = variantSummary(selection);
  if (variant) parts.push(variant);
  else parts.push(`Set Secimi ${index + 1}`);
  return parts.join(" ");
}

function buildAdjustmentRows(snapshot = {}) {
  const pricing =
    snapshot?.pricing && typeof snapshot.pricing === "object"
      ? snapshot.pricing
      : {};
  const coupon =
    snapshot?.coupon && typeof snapshot.coupon === "object"
      ? snapshot.coupon
      : {};

  return [
    Number(pricing.standardDiscountAmount || 0) > 0
      ? {
          label: "Normal Ind.",
          value: -Math.abs(Number(pricing.standardDiscountAmount || 0) || 0),
        }
      : null,
    Number(pricing.stackedDiscountAmount || 0) > 0
      ? {
          label:
            Number(pricing?.stacked?.percentage || 0) > 0
              ? `Katlanan %${Number(pricing.stacked.percentage || 0)}`
              : "Katlanan Ind.",
          value: -Math.abs(Number(pricing.stackedDiscountAmount || 0) || 0),
        }
      : null,
    Number(coupon.discountAmount || 0) > 0
      ? {
          label: coupon.code ? `Kupon ${coupon.code}` : "Kupon",
          value: -Math.abs(Number(coupon.discountAmount || 0) || 0),
        }
      : null,
  ].filter(Boolean);
}

function pushText(commands, x, y, xMul, yMul, text) {
  if (!text) return;
  commands.push(`TEXT ${x},${y},"0",0,${xMul},${yMul},"${escapeTspl(text)}"`);
}

function pushBox(commands, x0, y0, x1, y1, thickness = 1) {
  commands.push(`BOX ${x0},${y0},${x1},${y1},${thickness}`);
}

export function buildOrderLabelTspl(snapshot = {}, options = {}) {
  const commands = [];
  const width = mm(LABEL_WIDTH_MM);
  const height = mm(LABEL_HEIGHT_MM);
  const gapMm = Math.max(1, Number(options.gapMm || DEFAULT_GAP_MM));
  const rawItems = Array.isArray(snapshot.items)
    ? snapshot.items.map((item, index) => ({
        id: item?.ref || `${index}`,
        name: item?.name || `Urun ${index + 1}`,
        qty: Number(item?.qty || 1) || 1,
        qtyLabel: `${Number(item?.qty || 1) || 1} adet`,
        unitPriceLabel: formatMoney(item?.unitPrice || 0),
        lineTotalLabel: formatMoney(
          (Number(item?.unitPrice || 0) || 0) * (Number(item?.qty || 0) || 1)
        ),
        variantSummary: variantSummary(item?.variant),
        selectionLines: Array.isArray(item?.selections)
          ? item.selections.map((selection, selectionIndex) =>
              selectionSummary(selection, selectionIndex)
            )
          : [],
      }))
    : [];
  const adaptiveLayout = buildAdaptiveOrderPrintLayout({
    customerName:
      snapshot.address?.fullName || snapshot.user?.firstName || "-",
    addressLines: [
      snapshot.address?.addressLine || "-",
      [snapshot.address?.district, snapshot.address?.city]
        .filter(Boolean)
        .join(" / "),
      [snapshot.address?.postalCode, snapshot.address?.country]
        .filter(Boolean)
        .join(" "),
    ].filter(Boolean),
    note: snapshot.note || "",
    items: rawItems,
  });
  const profile = getOrderPrintLayoutProfile(adaptiveLayout.key);
  const tspl = profile.tspl || {};

  commands.push(`SIZE ${LABEL_WIDTH_MM} mm,${LABEL_HEIGHT_MM} mm`);
  commands.push(`GAP ${gapMm} mm,0 mm`);
  commands.push("DIRECTION 1,0");
  commands.push("REFERENCE 0,0");
  commands.push("OFFSET 0 mm");
  commands.push("SPEED 4");
  commands.push("DENSITY 8");
  commands.push("SET TEAR ON");
  commands.push("CLS");

  let cursorY = 22;
  const left = 26;
  const right = width - 26;

  pushText(
    commands,
    left,
    cursorY,
    Number(tspl.headerTitleMul || 2) || 2,
    Number(tspl.headerTitleMul || 2) || 2,
    "BERKAY GSM"
  );
  cursorY += 40;
  pushText(
    commands,
    left,
    cursorY,
    1,
    1,
    `Siparis ${snapshot.orderNumber || "-"}`
  );
  cursorY += 24;
  pushText(commands, left, cursorY, 1, 1, formatDate(snapshot.createdAt));
  cursorY += 26;
  commands.push(`BAR ${left},${cursorY},${right - left},2`);
  cursorY += 18;

  const receiverTop = cursorY;
  const receiverHeight = Number(tspl.receiverHeight || 118) || 118;
  pushBox(commands, left, receiverTop, right, receiverTop + receiverHeight, 1);
  pushText(commands, left + 12, receiverTop + 10, 1, 1, "ALICI");
  const nameLines = Array.isArray(adaptiveLayout.customerNameLines)
    ? adaptiveLayout.customerNameLines
    : [snapshot.address?.fullName || snapshot.user?.firstName || "-"];
  let lineY = receiverTop + 38;
  nameLines.forEach((line) => {
    pushText(commands, left + 12, lineY, 1, 1, line);
    lineY += Number(tspl.receiverNameLineHeight || 24) || 24;
  });
  pushText(
    commands,
    left + 12,
    receiverTop + receiverHeight - 28,
    1,
    1,
    snapshot.address?.phone || snapshot.user?.phone || "-"
  );
  cursorY = receiverTop + receiverHeight + 14;

  const addressTop = cursorY;
  const addressHeight = Number(tspl.addressHeight || 164) || 164;
  pushBox(commands, left, addressTop, right, addressTop + addressHeight, 1);
  pushText(commands, left + 12, addressTop + 10, 1, 1, "ADRES");
  const addressLines = Array.isArray(adaptiveLayout.addressLines)
    ? adaptiveLayout.addressLines
    : [];
  lineY = addressTop + 38;
  addressLines.forEach((line) => {
    pushText(commands, left + 12, lineY, 1, 1, line);
    lineY += Number(tspl.addressLineHeight || 22) || 22;
  });
  cursorY = addressTop + addressHeight + 14;

  const itemsTop = cursorY;
  const itemsHeight = Number(tspl.itemsHeight || 300) || 300;
  pushBox(commands, left, itemsTop, right, itemsTop + itemsHeight, 1);
  const itemCount = rawItems.reduce(
    (sum, item) => sum + Number(item?.qty || 0),
    0
  );
  pushText(commands, left + 12, itemsTop + 10, 1, 1, `URUNLER (${itemCount})`);
  lineY = itemsTop + 38;
  const maxItemsBottom = itemsTop + itemsHeight - 18;

  const items = Array.isArray(adaptiveLayout.items) ? adaptiveLayout.items : [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const priceText = item?.lineTotalLabel || "";
    const itemLines = Array.isArray(item?.nameLines)
      ? item.nameLines
      : wrapText(item?.name || `Urun ${index + 1}`, 30);
    const metaLines = Array.isArray(item?.metaLines) ? item.metaLines : [];
    const totalNeededLines = itemLines.length + metaLines.length;
    const nextBlockHeight =
      itemLines.length * (Number(tspl.itemNameLineHeight || 22) || 22) +
      metaLines.length * (Number(tspl.itemMetaLineHeight || 20) || 20) +
      (Number(tspl.itemGap || 4) || 4) +
      6;

    if (lineY + nextBlockHeight > maxItemsBottom) {
      pushText(commands, left + 12, lineY, 1, 1, "+ Siparis ozeti kisaltildi");
      lineY += 22;
      break;
    }

    itemLines.forEach((line, lineIndex) => {
      pushText(commands, left + 12, lineY, lineIndex === 0 ? 1 : 1, 1, line);
      if (lineIndex === 0 && priceText) {
        pushText(commands, right - 160, lineY, 1, 1, priceText);
      }
      lineY += Number(tspl.itemNameLineHeight || 22) || 22;
    });

    metaLines.forEach((line) => {
      pushText(commands, left + 12, lineY, 1, 1, line);
      lineY += Number(tspl.itemMetaLineHeight || 20) || 20;
    });

    lineY += Number(tspl.itemGap || 4) || 4;
  }

  cursorY = itemsTop + itemsHeight + 14;

  const totalsTop = cursorY;
  const adjustmentRows = buildAdjustmentRows(snapshot);
  const summaryRows = [
    {
      label: "Ara Toplam",
      value: Number(snapshot?.pricing?.baseSubtotal || snapshot?.subtotal || 0) || 0,
    },
    ...adjustmentRows,
    {
      label: snapshot.shippingName || "Kargo",
      value: Number(snapshot.shipping || 0) || 0,
    },
    {
      label: "Genel Toplam",
      value: Number(snapshot.total || 0) || 0,
    },
  ];
  const totalsHeight =
    44 +
    summaryRows.length * (Number(tspl.totalsRowHeight || 24) || 24);
  pushBox(commands, left, totalsTop, right, totalsTop + totalsHeight, 1);
  pushText(commands, left + 12, totalsTop + 10, 1, 1, "TOPLAMLAR");
  summaryRows.forEach((row, index) => {
    const rowY =
      totalsTop +
      38 +
      index * (Number(tspl.totalsRowHeight || 24) || 24);
    pushText(commands, left + 12, rowY, 1, 1, row.label);
    pushText(commands, right - 180, rowY, 1, 1, formatMoney(row.value));
  });
  cursorY = totalsTop + totalsHeight + 14;

  const noteLines = Array.isArray(adaptiveLayout.noteLines)
    ? adaptiveLayout.noteLines
    : [];
  if (noteLines.length) {
    const noteTop = cursorY;
    const noteBottom = height - 20;
    pushBox(commands, left, noteTop, right, noteBottom, 1);
    pushText(commands, left + 12, noteTop + 10, 1, 1, "SIPARIS NOTU");
    lineY = noteTop + 38;
    noteLines.forEach((line) => {
      pushText(commands, left + 12, lineY, 1, 1, line);
      lineY += Number(tspl.noteLineHeight || 20) || 20;
    });
  }

  commands.push("PRINT 1,1");
  return commands.join("\r\n");
}
