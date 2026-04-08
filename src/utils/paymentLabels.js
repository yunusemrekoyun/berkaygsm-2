const PAYMENT_METHOD_LABELS = {
  online: "Online Ödeme",
  cod: "Kapıda Ödeme",
  card: "Kredi Kartı",
  bank: "Banka Havalesi",
  transfer: "Banka Havalesi",
  other: "Diğer",
};

export function formatPaymentMethodLabel(
  value,
  fallback = "Geçmiş ödeme kaydı"
) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (!normalized) return "-";
  return PAYMENT_METHOD_LABELS[normalized] || fallback;
}

export { PAYMENT_METHOD_LABELS };
