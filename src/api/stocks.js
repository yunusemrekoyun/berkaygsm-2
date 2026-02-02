import { http, toQueryString } from "./client.js";

/* ---------------- helpers ---------------- */
const normalizeOwnerId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object") {
    if (typeof value.$oid === "string") return value.$oid.trim();
    if (typeof value.toHexString === "function") return value.toHexString();
    if (typeof value._id === "string") return value._id.trim();
    if (typeof value.id === "string") return value.id.trim();
    if (typeof value._id === "object")
      return normalizeOwnerId(value._id);
    if (typeof value.id === "object")
      return normalizeOwnerId(value.id);
  }
  return "";
};

const isObjectId = (v) =>
  typeof v === "string" && /^[0-9a-fA-F]{24}$/.test(v ?? "");

function normalizeComponents(value) {
  if (!value) return [];
  const arr = Array.isArray(value) ? value : [value];
  return arr
    .map((cmp) => ({
      product: cmp?.product ?? cmp?.productId ?? cmp?._id ?? null,
      quantity: Number.isFinite(Number(cmp?.quantity))
        ? Math.max(1, Number(cmp.quantity))
        : 1,
      color: cmp?.color ?? null,
      size: cmp?.size ?? null,
      attributeValue: cmp?.attributeValue ?? null,
    }))
    .filter((x) => x.product && isObjectId(String(x.product)));
}

/* ---------------- public api ---------------- */
export const stocksApi = {
  /**
   * Genel liste (admin)
   * GET /api/stocks?ownerModel=&owner=&search=&page=&limit=&isActive=
   * DÖNÜŞ: { items, pagination }
   */
  async list(params = {}) {
    const nextParams = { ...params };
    if (nextParams.owner) {
      const normalized = normalizeOwnerId(nextParams.owner);
      if (normalized) {
        nextParams.owner = normalized;
      } else {
        delete nextParams.owner;
      }
    }
    const qs = toQueryString(nextParams);
    const res = await http(`/stocks${qs}`, { auth: true });
    if (!res) {
      return {
        items: [],
        pagination: {
          page: params.page || 1,
          pages: 1,
          total: 0,
          limit: params.limit || 20,
        },
      };
    }
    // Çeşitli backend şekillerine karşı normalize et
    return {
      items: res.items || res.stocks || res.data || [],
      pagination: res.pagination || {
        page: res.page || 1,
        pages: res.pages || 1,
        total: res.total || (res.items || res.stocks || []).length || 0,
        limit: res.limit || params.limit || 20,
      },
    };
  },

  /**
   * Belirli owner altını getir (kısa yol)
   * GET /api/stocks?ownerModel=Product&owner=<id>
   */
  async listByOwner(ownerModel, owner) {
    if (!ownerModel) throw new Error("ownerModel is required");
    const safeOwner = normalizeOwnerId(owner);
    if (!isObjectId(safeOwner))
      throw new Error("owner must be a valid ObjectId");
    const data = await http(
      `/stocks/by-owner/${encodeURIComponent(ownerModel)}/${encodeURIComponent(
        safeOwner
      )}`,
      { auth: true }
    );
    return {
      items: data?.stocks || data?.items || [],
      pagination: data?.pagination || {
        page: 1,
        pages: 1,
        total: (data?.stocks || data?.items || []).length || 0,
        limit: (data?.stocks || data?.items || []).length || 0,
      },
    };
  },

  /**
   * Toptan değiştirme (replace): mevcut owner’a ait tüm satırları verilen listeyle değiştirir.
   * PUT /api/stocks/replace
   * body: { ownerModel, owner, items: [{color,size,attributeValue,qtyOnHand,sku?,note?,isActive?}] }
   */
  async replace({ ownerModel, owner, items = [] }) {
    if (!ownerModel) throw new Error("ownerModel is required");
    if (!isObjectId(owner)) throw new Error("owner must be a valid ObjectId");

    // items minimum normalize
    const normItems = (items || []).map((it) => ({
      color: it?.color ?? null,
      size: it?.size ?? null,
      attributeValue: it?.attributeValue ?? null,
      qtyOnHand: Number(it?.qtyOnHand) || 0,
      ...(it?.sku ? { sku: it.sku } : {}),
      ...(it?.note !== undefined ? { note: it.note } : {}),
      ...(it?.isActive !== undefined ? { isActive: !!it.isActive } : {}),
    }));
    const data = await http(`/stocks/sync`, {
      method: "PUT",
      body: { ownerModel, owner, rows: normItems },
      auth: true,
    });
    if (!data) {
      return { ok: true, count: 0 };
    }
    return { ok: !!data.ok, count: data.count ?? 0 };
  },

  /**
   * Tek satır upsert (owner + comboKey üzerinden)
   * POST /api/stocks
   */
  async upsert(payload = {}) {
    const body = { ...payload };
    if (!body.ownerModel) throw new Error("ownerModel is required");
    if (!isObjectId(body.owner))
      throw new Error("owner must be a valid ObjectId");

    if (body.ownerModel === "Set") {
      body.components = normalizeComponents(body.components);
    } else {
      delete body.components; // ürün tarafında components gönderme
    }

    const data = await http("/stocks", { method: "POST", body, auth: true });
    return data?.stock || null;
  },

  /**
   * Satır güncelle (delta veya set)
   * PATCH /api/stocks/:id
   */
  async update(id, payload = {}) {
    if (!id) throw new Error("stock id is required");
    const data = await http(`/stocks/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: payload,
      auth: true,
    });
    return data?.stock || null;
  },

  /**
   * Satır sil
   * DELETE /api/stocks/:id
   */
  async remove(id) {
    if (!id) throw new Error("stock id is required");
    await http(`/stocks/${encodeURIComponent(id)}`, {
      method: "DELETE",
      auth: true,
    });
    return true;
  },

  /* --------------- ui helpers --------------- */
  helpers: {
    forProduct({
      owner,
      color = null,
      size = null,
      attributeValue = null,
      qtyOnHand = 0,
      mode = "set",
      sku,
      note,
      isActive = true,
    }) {
      return {
        ownerModel: "Product",
        owner,
        color,
        size,
        attributeValue,
        qtyOnHand,
        mode,
        ...(sku ? { sku } : {}),
        ...(note !== undefined ? { note } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      };
    },

    forSet({
      owner,
      components = [],
      qtyOnHand = 0,
      mode = "set",
      sku,
      note,
      isActive = true,
    }) {
      return {
        ownerModel: "Set",
        owner,
        components: normalizeComponents(components),
        qtyOnHand,
        mode,
        ...(sku ? { sku } : {}),
        ...(note !== undefined ? { note } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      };
    },
  },
};
