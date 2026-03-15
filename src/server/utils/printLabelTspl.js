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

function wrapBlock(lines, maxChars, maxLines) {
  const wrapped = [];
  for (const line of lines) {
    for (const row of wrapText(line, maxChars)) {
      wrapped.push(row);
      if (wrapped.length >= maxLines) return wrapped;
    }
  }
  return wrapped;
}

function variantSummary(variant = null) {
  if (!variant || typeof variant !== "object") return "";
  const parts = [];
  if (variant.color) parts.push(`Renk ${variant.color}`);
  if (variant.size) parts.push(`Beden ${variant.size}`);
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

  pushText(commands, left, cursorY, 2, 2, "BERKAY GSM");
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
  const receiverHeight = 118;
  pushBox(commands, left, receiverTop, right, receiverTop + receiverHeight, 1);
  pushText(commands, left + 12, receiverTop + 10, 1, 1, "ALICI");
  const nameLines = wrapBlock(
    [snapshot.address?.fullName || snapshot.user?.firstName || "-"],
    28,
    2
  );
  let lineY = receiverTop + 38;
  nameLines.forEach((line) => {
    pushText(commands, left + 12, lineY, 1, 1, line);
    lineY += 24;
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
  const addressHeight = 164;
  pushBox(commands, left, addressTop, right, addressTop + addressHeight, 1);
  pushText(commands, left + 12, addressTop + 10, 1, 1, "ADRES");
  const addressLines = wrapBlock(
    [
      snapshot.address?.addressLine || "-",
      [snapshot.address?.district, snapshot.address?.city]
        .filter(Boolean)
        .join(" / "),
      [snapshot.address?.postalCode, snapshot.address?.country]
        .filter(Boolean)
        .join(" "),
    ],
    34,
    6
  );
  lineY = addressTop + 38;
  addressLines.forEach((line) => {
    pushText(commands, left + 12, lineY, 1, 1, line);
    lineY += 22;
  });
  cursorY = addressTop + addressHeight + 14;

  const itemsTop = cursorY;
  const itemsHeight = 300;
  pushBox(commands, left, itemsTop, right, itemsTop + itemsHeight, 1);
  const itemCount = (snapshot.items || []).reduce(
    (sum, item) => sum + Number(item?.qty || 0),
    0
  );
  pushText(commands, left + 12, itemsTop + 10, 1, 1, `URUNLER (${itemCount})`);
  lineY = itemsTop + 38;
  const maxItemsBottom = itemsTop + itemsHeight - 18;

  const items = Array.isArray(snapshot.items) ? snapshot.items : [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const priceText = formatMoney(
      (Number(item?.unitPrice || 0) || 0) * (Number(item?.qty || 0) || 1)
    );
    const itemLines = wrapText(item?.name || `Urun ${index + 1}`, 30);
    const variantLine = variantSummary(item?.variant);
    const selectionLines = Array.isArray(item?.selections)
      ? item.selections
          .slice(0, 2)
          .map((selection, selectionIndex) =>
            selectionSummary(selection, selectionIndex)
          )
      : [];
    const metaLines = [
      `${Number(item?.qty || 0) || 1} adet ${formatMoney(item?.unitPrice || 0)}`,
      variantLine,
      ...selectionLines,
    ].filter(Boolean);
    const totalNeededLines = itemLines.length + metaLines.length;
    const nextBlockHeight = totalNeededLines * 22 + 10;

    if (lineY + nextBlockHeight > maxItemsBottom) {
      pushText(commands, left + 12, lineY, 1, 1, "...");
      lineY += 22;
      break;
    }

    itemLines.forEach((line, lineIndex) => {
      pushText(commands, left + 12, lineY, lineIndex === 0 ? 1 : 1, 1, line);
      if (lineIndex === 0) {
        pushText(commands, right - 160, lineY, 1, 1, priceText);
      }
      lineY += 22;
    });

    metaLines.forEach((line) => {
      pushText(commands, left + 12, lineY, 1, 1, line);
      lineY += 20;
    });

    lineY += 4;
  }

  cursorY = itemsTop + itemsHeight + 14;

  const totalsTop = cursorY;
  const totalsHeight = 116;
  pushBox(commands, left, totalsTop, right, totalsTop + totalsHeight, 1);
  pushText(commands, left + 12, totalsTop + 10, 1, 1, "TOPLAMLAR");
  pushText(commands, left + 12, totalsTop + 38, 1, 1, "Ara Toplam");
  pushText(commands, right - 180, totalsTop + 38, 1, 1, formatMoney(snapshot.subtotal));
  pushText(
    commands,
    left + 12,
    totalsTop + 62,
    1,
    1,
    snapshot.shippingName || "Kargo"
  );
  pushText(
    commands,
    right - 180,
    totalsTop + 62,
    1,
    1,
    formatMoney(snapshot.shipping)
  );
  pushText(commands, left + 12, totalsTop + 88, 1, 1, "Genel Toplam");
  pushText(commands, right - 180, totalsTop + 88, 1, 1, formatMoney(snapshot.total));
  cursorY = totalsTop + totalsHeight + 14;

  const note = sanitizeLine(snapshot.note || "");
  if (note) {
    const noteTop = cursorY;
    const noteBottom = height - 20;
    pushBox(commands, left, noteTop, right, noteBottom, 1);
    pushText(commands, left + 12, noteTop + 10, 1, 1, "SIPARIS NOTU");
    const noteLines = wrapBlock([note], 36, 4);
    lineY = noteTop + 38;
    noteLines.forEach((line) => {
      pushText(commands, left + 12, lineY, 1, 1, line);
      lineY += 20;
    });
  }

  commands.push("PRINT 1,1");
  return commands.join("\r\n");
}
