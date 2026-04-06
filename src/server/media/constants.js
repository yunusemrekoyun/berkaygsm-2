export const DEFAULT_ALLOWED_FORMATS = {
  image: ["jpg", "jpeg", "png", "webp", "avif", "gif"],
  video: ["mp4", "webm", "mov", "m4v"],
};

export const IMAGE_VARIANTS = [
  { name: "thumb", width: 160, quality: 68 },
  { name: "card", width: 640, quality: 76 },
  { name: "large", width: 1600, quality: 84 },
];

export const UPLOAD_SCOPES = {
  products: { folder: "products", adminOnly: true, resourceTypes: ["image", "video"] },
  sets: { folder: "sets", adminOnly: true, resourceTypes: ["image", "video"] },
  categories: { folder: "categories", adminOnly: true, resourceTypes: ["image"] },
  campaigns: { folder: "campaigns", adminOnly: true, resourceTypes: ["image"] },
  heroes: { folder: "heroes", adminOnly: true, resourceTypes: ["image", "video"] },
  about: { folder: "about", adminOnly: true, resourceTypes: ["image"] },
  contact: { folder: "contact", adminOnly: true, resourceTypes: ["image"] },
  media: { folder: "media", adminOnly: true, resourceTypes: ["image", "video"] },
  avatars: {
    folder: "avatars",
    adminOnly: false,
    resourceTypes: ["image"],
    allowClientSignature: false,
  },
};

export function resolveScopeConfig(scope) {
  const normalized = String(scope || "media").toLowerCase();
  return UPLOAD_SCOPES[normalized] || null;
}
