export function normalizeTrPhoneDigits(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";

  let local = digits;
  if (local.startsWith("90")) {
    local = local.slice(2);
  }
  local = local.replace(/^0+/, "");
  return local.slice(0, 10);
}

export function formatTrPhoneForInput(value) {
  const raw = String(value || "");
  if (!raw.trim()) return "";

  const digits = raw.replace(/\D/g, "");
  const local = normalizeTrPhoneDigits(raw);

  if (!local) {
    if (digits === "0" || digits === "90" || raw.includes("+90")) {
      return "+90";
    }
    return "";
  }

  const p1 = local.slice(0, 3);
  const p2 = local.slice(3, 6);
  const p3 = local.slice(6, 8);
  const p4 = local.slice(8, 10);
  const parts = [p1, p2, p3, p4].filter(Boolean);
  return `+90 ${parts.join(" ")}`;
}

export function formatTrPhoneForSubmit(value) {
  const local = normalizeTrPhoneDigits(value);
  if (!local) return "";
  return `+90${local}`;
}
