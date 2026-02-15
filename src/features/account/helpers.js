export const ACCOUNT_TABS = [
  "Overview",
  "Orders",
  "Addresses",
  "Wishlist",
  "Coupons",
];

export const normalizeTab = (raw) => {
  if (!raw) return null;
  const t = String(raw).toLowerCase();
  if (["wishlist", "favorites", "favoriler"].includes(t)) return "Wishlist";
  if (["coupons", "coupon", "kuponlar", "kuponlarim", "kuponlarım"].includes(t)) {
    return "Coupons";
  }
  if (["addresses", "address", "adresler"].includes(t)) return "Addresses";
  if (["orders", "siparisler"].includes(t)) return "Orders";
  if (["overview", "profil"].includes(t)) return "Overview";
  return null;
};

export function normalizeUrl(u) {
  if (!u) return null;
  try {
    if (/^https?:\/\//i.test(u)) return u;
    if (/^data:image\//i.test(u)) return u;
    if (/^\/\//.test(u)) return window.location.protocol + u;
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
    const origin = apiBase.replace(/\/api\/?$/i, "");
    const path = u.startsWith("/") ? u : `/${u}`;
    return `${origin}${path}`;
  } catch {
    return u;
  }
}

export function extractAvatarUrl(any) {
  if (!any) return null;
  if (typeof any === "string") return normalizeUrl(any);

  if (any.avatarUrl) return normalizeUrl(any.avatarUrl);
  const avatar =
    any.avatar || any.profile?.avatar || any.details?.avatar || any.user?.avatar;
  if (avatar) {
    return normalizeUrl(avatar.secure_url || avatar.url || avatar.path || avatar.avatarUrl);
  }

  if (any.url || any.secure_url || any.path) {
    return normalizeUrl(any.secure_url || any.url || any.path);
  }

  return null;
}

export function extractErrorMessage(error) {
  try {
    const text = error?.message || String(error);
    const parsed = JSON.parse(text);
    return parsed?.message || text;
  } catch {
    return error?.message || "Beklenmeyen bir hata oluştu";
  }
}
