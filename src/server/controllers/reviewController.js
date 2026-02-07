import mongoose from "mongoose";
import Review from "../models/Review.js";
import Product from "../models/Product.js";
import Set from "../models/Set.js";
import UserDetails from "../models/UserDetails.js";

const isObjectId = (v) => typeof v === "string" && /^[0-9a-fA-F]{24}$/.test(v);

const basePopulates = [
  { path: "user", select: "firstName lastName email" },
  { path: "product", select: "name slug" },
  { path: "set", select: "name slug" },
  { path: "approvedBy", select: "firstName lastName email" },
];

async function findProductByIdOrSlug(idOrSlug) {
  if (!idOrSlug) return null;
  const filter = isObjectId(idOrSlug) ? { _id: idOrSlug } : { slug: idOrSlug };
  return Product.findOne(filter).select("_id name slug");
}

async function findSetByIdOrSlug(idOrSlug) {
  if (!idOrSlug) return null;
  const filter = isObjectId(idOrSlug) ? { _id: idOrSlug } : { slug: idOrSlug };
  return Set.findOne(filter).select("_id name slug");
}

const toId = (value, depth = 0) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (depth > 5) return null;
  if (value instanceof mongoose.Types.ObjectId) return value.toString();
  if (typeof value === "object") {
    if (value._id && value._id !== value) {
      return toId(value._id, depth + 1);
    }
    try {
      if (typeof value.valueOf === "function") {
        const primitive = value.valueOf();
        if (primitive !== value) {
          const result = toId(primitive, depth + 1);
          if (result) return result;
        }
      }
    } catch {
      /* ignore */
    }
    if (typeof value.toString === "function") {
      const str = value.toString();
      if (str && str !== "[object Object]") return str;
    }
  }
  return null;
};

const fullName = (entity) => {
  if (!entity) return null;
  const first = entity.firstName || "";
  const last = entity.lastName || "";
  const combined = `${first} ${last}`.trim();
  if (combined) return combined;
  return entity.email || null;
};

const serializeAdminReview = (review) => ({
  id: toId(review?._id),
  rating: review?.rating ?? null,
  title: review?.title || "",
  body: review?.body || "",
  approved: Boolean(review?.approved),
  status: review?.approved ? "approved" : "pending",
  createdAt: review?.createdAt || null,
  updatedAt: review?.updatedAt || null,
  approvedAt: review?.approvedAt || null,
  product: review?.product
    ? {
        id: toId(review.product),
        name: review.product?.name || null,
        slug: review.product?.slug || null,
      }
    : null,
  set: review?.set
    ? {
        id: toId(review.set),
        name: review.set?.name || null,
        slug: review.set?.slug || null,
      }
    : null,
  target: review?.product
    ? {
        type: "product",
        id: toId(review.product),
        name: review.product?.name || null,
        slug: review.product?.slug || null,
      }
    : review?.set
    ? {
        type: "set",
        id: toId(review.set),
        name: review.set?.name || null,
        slug: review.set?.slug || null,
      }
    : null,
  user: review?.user
    ? {
        id: toId(review.user),
        name: fullName(review.user) || "Anonim",
        email: review.user?.email || null,
      }
    : null,
  approvedBy: review?.approvedBy
    ? {
        id: toId(review.approvedBy),
        name: fullName(review.approvedBy),
        email: review.approvedBy?.email || null,
      }
    : null,
});

async function fetchReviewsForAdmin({
  filter = {},
  page = 1,
  limit = 20,
  sort = { createdAt: -1 },
  search = "",
}) {
  const query = { ...filter };
  const trimmed = typeof search === "string" ? search.trim() : "";
  if (trimmed) {
    const regex = new RegExp(trimmed, "i");
    query.$or = [{ title: regex }, { body: regex }];
  }

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Review.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate(basePopulates)
      .lean(),
    Review.countDocuments(query),
  ]);

  return {
    items: items.map(serializeAdminReview),
    total,
  };
}

/**
 * PUBLIC: Belirli ürünün onaylı yorumlarını getir
 * GET /api/reviews/product/:idOrSlug?page=&limit=
 */
export async function listApprovedForProduct(req, res) {
  try {
    const { idOrSlug } = req.params;
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));

    const product = await findProductByIdOrSlug(idOrSlug);
    if (!product) return res.status(404).json({ message: "Ürün bulunamadı" });

    const [items, total] = await Promise.all([
      Review.find({ product: product._id, approved: true })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate({ path: "user", select: "firstName lastName role" })
        .lean(),
      Review.countDocuments({ product: product._id, approved: true }),
    ]);

    // UI için hafif şekillendirme
    const reviews = items.map((r) => ({
      id: r._id.toString(),
      rating: r.rating,
      title: r.title,
      body: r.body,
      createdAt: r.createdAt,
      user: {
        id: r.user?._id?.toString?.() || null,
        name: r.user
          ? `${r.user.firstName} ${r.user.lastName}`.trim()
          : "Anonim",
      },
    }));

    res.json({
      reviews,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

/**
 * PUBLIC: Ürün için istatistik (onaylılar)
 * GET /api/reviews/product/:idOrSlug/stats
 */
export async function productReviewStats(req, res) {
  try {
    const { idOrSlug } = req.params;
    const product = await findProductByIdOrSlug(idOrSlug);
    if (!product) return res.status(404).json({ message: "Ürün bulunamadı" });

    const [agg] = await Review.aggregate([
      { $match: { product: product._id, approved: true } },
      {
        $group: {
          _id: "$product",
          avgRating: { $avg: "$rating" },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          avgRating: { $round: ["$avgRating", 2] },
          count: 1,
        },
      },
    ]);

    res.json({ stats: agg || { avgRating: 0, count: 0 } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

/**
 * PUBLIC: Belirli set'in onaylı yorumlarını getir
 * GET /api/reviews/set/:idOrSlug?page=&limit=
 */
export async function listApprovedForSet(req, res) {
  try {
    const { idOrSlug } = req.params;
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));

    const setDoc = await findSetByIdOrSlug(idOrSlug);
    if (!setDoc) return res.status(404).json({ message: "Set bulunamadı" });

    const [items, total] = await Promise.all([
      Review.find({ set: setDoc._id, approved: true })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate({ path: "user", select: "firstName lastName role" })
        .lean(),
      Review.countDocuments({ set: setDoc._id, approved: true }),
    ]);

    const reviews = items.map((r) => ({
      id: r._id.toString(),
      rating: r.rating,
      title: r.title,
      body: r.body,
      createdAt: r.createdAt,
      user: {
        id: r.user?._id?.toString?.() || null,
        name: r.user
          ? `${r.user.firstName} ${r.user.lastName}`.trim()
          : "Anonim",
      },
    }));

    res.json({
      reviews,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

/**
 * PUBLIC: Set için istatistik (onaylılar)
 * GET /api/reviews/set/:idOrSlug/stats
 */
export async function setReviewStats(req, res) {
  try {
    const { idOrSlug } = req.params;
    const setDoc = await findSetByIdOrSlug(idOrSlug);
    if (!setDoc) return res.status(404).json({ message: "Set bulunamadı" });

    const [agg] = await Review.aggregate([
      { $match: { set: setDoc._id, approved: true } },
      {
        $group: {
          _id: "$set",
          avgRating: { $avg: "$rating" },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          avgRating: { $round: ["$avgRating", 2] },
          count: 1,
        },
      },
    ]);

    res.json({ stats: agg || { avgRating: 0, count: 0 } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

/**
 * AUTH: Yorum oluştur (onaya düşer)
 * POST /api/reviews
 * body: { productId|productSlug | setId|setSlug, rating(1-5), title?, body? }
 */
export async function createReview(req, res) {
  try {
    const {
      productId,
      productSlug,
      setId,
      setSlug,
      rating,
      title = "",
      body = "",
    } = req.body;
    const userId = req.userId;

    const product =
      (productId && (await findProductByIdOrSlug(productId))) ||
      (productSlug && (await findProductByIdOrSlug(productSlug)));

    const set =
      (setId && (await findSetByIdOrSlug(setId))) ||
      (setSlug && (await findSetByIdOrSlug(setSlug)));

    if (product && set) {
      return res
        .status(400)
        .json({ message: "Yorum aynı anda ürün ve sete bağlı olamaz" });
    }

    if (!product && !set) {
      return res
        .status(400)
        .json({ message: "Geçersiz ürün veya set referansı" });
    }

    const r = Number(rating);
    if (!Number.isFinite(r) || r < 1 || r > 5) {
      return res
        .status(400)
        .json({ message: "Puan 1 ile 5 arasında olmalı" });
    }

    const targetFilter = product
      ? { product: product._id, user: userId }
      : { set: set._id, user: userId };

    const exists = await Review.exists(targetFilter);
    if (exists) {
      return res.status(409).json({
        message: product
          ? "You have already reviewed this product"
          : "You have already reviewed this set",
      });
    }

    const review = await Review.create({
      product: product?._id || null,
      set: set?._id || null,
      user: userId,
      rating: Math.round(r), // tam sayılamak istersen
      title: String(title || "").trim(),
      body: String(body || "").trim(),
      approved: false,
    });

    res.status(201).json({
      review: {
        id: review._id.toString(),
        approved: review.approved,
      },
    });
  } catch (err) {
    // unique index ihlali (product+user / set+user) yakala
    if (err?.code === 11000) {
      return res.status(409).json({
        message: "Bu içerik için zaten yorum gönderdiniz",
      });
    }
    res.status(400).json({ message: err.message });
  }
}

/**
 * ADMIN: Bekleyen yorumlar
 * GET /api/reviews/pending?page=&limit=
 */
export async function listPendingReviews(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));

    const { items, total } = await fetchReviewsForAdmin({
      filter: { approved: false },
      page,
      limit,
      sort: { createdAt: 1 },
    });

    res.json({
      reviews: items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

/**
 * ADMIN: Onayla
 * PATCH /api/reviews/:id/approve
 */
export async function approveReview(req, res) {
  try {
    const { id } = req.params;
    const review = await Review.findById(id);
    if (!review) return res.status(404).json({ message: "Yorum bulunamadı" });
    if (review.approved)
      return res.status(400).json({ message: "Zaten onaylanmış" });

    review.approved = true;
    review.approvedAt = new Date();
    review.approvedBy = req.userId;

    await review.save();
    const populated = await Review.findById(review._id)
      .populate(basePopulates)
      .lean();

    res.json({ review: serializeAdminReview(populated) });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

/**
 * ADMIN: Reddet (sil)
 * DELETE /api/reviews/:id
 */
export async function deleteReview(req, res) {
  try {
    const { id } = req.params;
    const review = await Review.findById(id);
    if (!review) return res.status(404).json({ message: "Yorum bulunamadı" });

    await review.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

/**
 * ADMIN: Tüm yorumları listele (approved/pending filtreli)
 * GET /api/reviews?status=&page=&limit=&search=&product=
 */
export async function listAdminReviews(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const status = String(req.query.status || "all").toLowerCase();
    const search = String(req.query.search || "").trim();

    const filter = {};
    if (status === "pending") filter.approved = false;
    else if (status === "approved") filter.approved = true;

    if (req.query.product) {
      const product = await findProductByIdOrSlug(req.query.product);
      if (!product) {
        return res.json({
          reviews: [],
          pagination: { page, limit, total: 0, pages: 1 },
        });
      }
      filter.product = product._id;
    }

    if (req.query.set) {
      const setDoc = await findSetByIdOrSlug(req.query.set);
      if (!setDoc) {
        return res.json({
          reviews: [],
          pagination: { page, limit, total: 0, pages: 1 },
        });
      }
      filter.set = setDoc._id;
    }

    if (req.query.user && isObjectId(req.query.user)) {
      filter.user = req.query.user;
    }

    const { items, total } = await fetchReviewsForAdmin({
      filter,
      page,
      limit,
      sort: { createdAt: -1 },
      search,
    });

    res.json({
      reviews: items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}
// Home için onaylı yorumlar: rating ↓, createdAt ↓
export async function listHomeFeaturedReviews(req, res) {
  try {
    const limit = Math.min(12, Math.max(1, Number(req.query.limit || 3)));
    const items = await Review.find({ approved: true })
      .sort({ rating: -1, createdAt: -1 })
      .limit(limit)
      .populate([
        { path: "user", select: "firstName lastName email" },
        { path: "product", select: "name slug" },
        { path: "set", select: "name slug" },
      ])
      .lean();

    const userIds = Array.from(
      new Set(
        items
          .map((r) => r.user?._id?.toString?.() || null)
          .filter(Boolean)
      )
    );

    let avatarsByUser = new Map();
    if (userIds.length > 0) {
      const details = await UserDetails.find({ user: { $in: userIds } })
        .select("user avatar")
        .lean();
      avatarsByUser = new Map(
        details
          .filter((detail) => detail.avatar?.url)
          .map((detail) => [
            detail.user.toString(),
            {
              url: detail.avatar.url,
              publicId: detail.avatar.publicId,
              width: detail.avatar.width,
              height: detail.avatar.height,
              format: detail.avatar.format,
            },
          ])
      );
    }

    const reviews = items.map((r) => {
      const userId = r.user?._id?.toString?.() || null;
      const avatar = userId ? avatarsByUser.get(userId) || null : null;
      return {
        // HomeProductCommentItem şekline uygun dönüştürüyoruz
        name:
          (r.user?.firstName || "") +
            (r.user?.lastName ? ` ${r.user.lastName}` : "") || "Müşteri",
        quote: r.body || r.title || "", // kısa metin
        rating: Number(r.rating) || 0,
        avatar,
      };
    });

    res.json({ reviews });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

/**
 * ADMIN: Yorum sayıları
 * GET /api/reviews/summary
 */
export async function reviewSummary(req, res) {
  try {
    const [pending, approved, total] = await Promise.all([
      Review.countDocuments({ approved: false }),
      Review.countDocuments({ approved: true }),
      Review.countDocuments(),
    ]);

    res.json({
      summary: {
        pending,
        approved,
        total,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}
