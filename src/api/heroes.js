// frontend/src/api/heroes.js
import { http, toQueryString } from "./client.js";
import { DEFAULT_LANG } from "../constants/lang.js";

/* ------------------ ID yardımcıları (Buffer → string) ------------------ */

function bytesToHex(data) {
  if (!Array.isArray(data)) return "";
  return data
    .map((num) => {
      const n = Number(num) & 0xff;
      return n.toString(16).padStart(2, "0");
    })
    .join("");
}

function extractFromBufferLike(obj) {
  if (!obj || typeof obj !== "object") return "";

  // { buffer: { type: 'Buffer', data: [...] } }
  if (
    obj.buffer &&
    typeof obj.buffer === "object" &&
    obj.buffer.type === "Buffer" &&
    Array.isArray(obj.buffer.data)
  ) {
    return bytesToHex(obj.buffer.data);
  }

  // { type: 'Buffer', data: [...] }
  if (obj.type === "Buffer" && Array.isArray(obj.data)) {
    return bytesToHex(obj.data);
  }

  return "";
}

/**
 * Gelen herhangi bir değerden mümkünse hero ID string'i çıkarır.
 * - String ise trimleyip döner
 * - Number ise string'e çevirir
 * - Buffer benzeri objeyi hex string'e çevirir
 * - Obje ise id / _id / hero.id / hero._id / vs bakar
 */
export function normalizeHeroId(value) {


  if (value === null || value === undefined) return "";

  // 1) Direkt string
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed && trimmed !== "[object Object]" ? trimmed : "";
  }

  // 2) Direkt number
  if (typeof value === "number") {
    return String(value);
  }

  // 3) Direkt buffer-benzeri obje olabilir
  const directBuf = extractFromBufferLike(value);
  if (directBuf) {

    return directBuf;
  }

  // 4) Obje içinden id / _id / hero.id / hero._id vb. çek
  if (typeof value === "object") {
    let raw =
      value.id ??
      value._id ??
      (value.hero &&
        (value.hero.id ||
          value.hero._id ||
          (typeof value.hero.toHexString === "function"
            ? value.hero.toHexString()
            : null)));



    // 4a) raw'ın kendisi buffer-benzeri olabilir
    const nestedBuf = extractFromBufferLike(raw);
    if (nestedBuf) {

      return nestedBuf;
    }

    // 4b) ObjectId benzeri obje ise
    if (!raw && typeof value.toHexString === "function") {
      return value.toHexString();
    }

    if (!raw && typeof value.toString === "function") {
      const str = value.toString();
      const trimmed = String(str).trim();
      if (trimmed && trimmed !== "[object Object]") return trimmed;
    }

    if (typeof raw === "string") {
      const trimmed = raw.trim();
      return trimmed && trimmed !== "[object Object]" ? trimmed : "";
    }

    if (typeof raw === "number") {
      return String(raw);
    }

    if (raw && typeof raw === "object") {
      const maybeId =
        raw._id ||
        raw.id ||
        (typeof raw.toHexString === "function" ? raw.toHexString() : undefined);

      const bufFromNested = extractFromBufferLike(raw);
      if (bufFromNested) return bufFromNested;

      if (typeof maybeId === "string") {
        const trimmed = maybeId.trim();
        if (trimmed && trimmed !== "[object Object]") return trimmed;
      }
    }
  }

  // 5) Son çare
  try {
    const fallback = String(value).trim();

    return fallback && fallback !== "[object Object]" ? fallback : "";
  } catch {
    return "";
  }
}

/* --------------------------- API nesnesi --------------------------- */

export const heroApi = {
  async list({ includeInactive = false } = {}, lang = DEFAULT_LANG) {
    const qs = toQueryString({
      includeInactive: includeInactive ? "true" : undefined,
      lang: lang ?? DEFAULT_LANG,
    });
    const data = await http(`/heroes${qs}`, { auth: includeInactive });



    const rawHeroes = data.heroes || [];
    const mapped = rawHeroes.map((h) => {
      const id =
        normalizeHeroId(h.id) ||
        normalizeHeroId(h._id) ||
        normalizeHeroId(h.hero) ||
        normalizeHeroId(h);



      // id üretebildiysek buffer objesini override edelim
      return id ? { ...h, id } : h;
    });


    return mapped;
  },

  async get(id, lang = DEFAULT_LANG) {

    const identifier = normalizeHeroId(id);

    if (!identifier) {
      throw new Error(JSON.stringify({ message: "Hero kimliği bulunamadı" }));
    }

    const qs = toQueryString({ lang: lang ?? DEFAULT_LANG });
    const data = await http(`/heroes/${identifier}${qs}`, { auth: true });

    const hero = data.hero;
    const normId =
      normalizeHeroId(hero?.id) ||
      normalizeHeroId(hero?._id) ||
      normalizeHeroId(hero);

    return normId ? { ...hero, id: normId } : hero;
  },

  async create(
    {
      title,
      subtitle,
      buttonText = "",
      targetType = "SHOP",
      categories = [],
      isActive = true,
      sortOrder = 0,
      file,
    },
    lang = DEFAULT_LANG
  ) {
    const form = new FormData();
    form.append("title", String(title).trim());
    form.append("subtitle", String(subtitle).trim());
    if (buttonText !== undefined) form.append("buttonText", String(buttonText));
    form.append("targetType", String(targetType).toUpperCase());
    form.append("isActive", isActive ? "true" : "false");
    form.append("sortOrder", String(Number(sortOrder) || 0));

    if (Array.isArray(categories) && categories.length) {
      form.append("categories", categories.join(","));
    }
    if (file) form.append("media", file);

    const qs = toQueryString({ lang: lang ?? DEFAULT_LANG });
    const data = await http(`/heroes${qs}`, {
      method: "POST",
      body: form,
      auth: true,
    });

    const hero = data.hero;
    const normId =
      normalizeHeroId(hero?.id) ||
      normalizeHeroId(hero?._id) ||
      normalizeHeroId(hero);

    return normId ? { ...hero, id: normId } : hero;
  },

  async update(
    id,
    {
      title,
      subtitle,
      buttonText,
      targetType,
      categories,
      isActive,
      sortOrder,
      file,
      removeMedia,
    },
    lang = DEFAULT_LANG
  ) {

    const identifier = normalizeHeroId(id);

    if (!identifier) {
      throw new Error(JSON.stringify({ message: "Hero kimliği bulunamadı" }));
    }

    const form = new FormData();
    if (title !== undefined) form.append("title", String(title));
    if (subtitle !== undefined) form.append("subtitle", String(subtitle));
    if (buttonText !== undefined) form.append("buttonText", String(buttonText));
    if (targetType !== undefined)
      form.append("targetType", String(targetType).toUpperCase());
    if (Array.isArray(categories))
      form.append("categories", categories.join(","));
    if (isActive !== undefined)
      form.append("isActive", isActive ? "true" : "false");
    if (sortOrder !== undefined)
      form.append("sortOrder", String(Number(sortOrder) || 0));
    if (file) form.append("media", file);
    if (removeMedia) form.append("removeMedia", "true");

    const qs = toQueryString({ lang: lang ?? DEFAULT_LANG });
    const data = await http(`/heroes/${identifier}${qs}`, {
      method: "PUT",
      body: form,
      auth: true,
    });

    const hero = data.hero;
    const normId =
      normalizeHeroId(hero?.id) ||
      normalizeHeroId(hero?._id) ||
      normalizeHeroId(hero);

    return normId ? { ...hero, id: normId } : hero;
  },

  async remove(id) {

    const identifier = normalizeHeroId(id);

    if (!identifier) {
      throw new Error(JSON.stringify({ message: "Hero kimliği bulunamadı" }));
    }
    await http(`/heroes/${identifier}`, { method: "DELETE", auth: true });
    return true;
  },

  async reorder(orders) {

    const normalized = (orders || []).map((entry) => ({
      id: normalizeHeroId(entry.id),
      sortOrder: entry.sortOrder,
    }));


    await http(`/heroes/reorder`, {
      method: "POST",
      auth: true,
      body: { orders: normalized },
      headers: { "Content-Type": "application/json" },
    });

    return true;
  },
};
