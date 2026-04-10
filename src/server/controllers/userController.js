import mongoose from "mongoose";
import User from "../models/User.js";
import { buildUserFilter, shapeUser } from "../utils/userPresenter.js";

const SORT_MAP = {
  recent: { createdAt: -1 },
  oldest: { createdAt: 1 },
  name: { firstName: 1, lastName: 1 },
  role: { role: 1, createdAt: -1 },
};

const MIN_LIMIT = 5;
const MAX_LIMIT = 100;

export async function listUsers(req, res) {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      role = "",
      sort = "recent",
      status = "",
      includeDeleted = "false",
    } = req.query;

    const pageNumber = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(
      MAX_LIMIT,
      Math.max(MIN_LIMIT, Number(limit) || MIN_LIMIT)
    );
    const includeDel = String(includeDeleted).toLowerCase() === "true";

    const filter = buildUserFilter({
      search,
      role,
      status,
      includeDeleted: includeDel,
    });
    const sortOption = SORT_MAP[sort] || SORT_MAP.recent;

    const [users, total, metrics] = await Promise.all([
      User.find(filter)
        .sort(sortOption)
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      User.countDocuments(filter),
      collectUserMetrics(), // metriklerde silinmiş sayıları da göstereceğiz
    ]);

    res.json({
      users: users.map(shapeUser),
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total,
        pages: Math.max(1, Math.ceil(total / pageSize)),
      },
      metrics,
      appliedFilters: { search, role, sort, status, includeDeleted: includeDel },
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "Kullanıcılar listelenemedi" });
  }
}

export async function getUser(req, res) {
  try {
    const { idOrKey } = req.params;
    const isId = mongoose.Types.ObjectId.isValid(idOrKey);
    const user = isId
      ? await User.findById(idOrKey)
      : await User.findOne({ email: idOrKey });

    if (!user) return res.status(404).json({ message: "Kullanıcı bulunamadı" });
    res.json({ user: shapeUser(user) });
  } catch (error) {
    res.status(500).json({ message: error.message || "Kullanıcı alınamadı" });
  }
}

export async function updateUser(req, res) {
  try {
    const { idOrKey } = req.params;
    const isId = mongoose.Types.ObjectId.isValid(idOrKey);
    const user = isId
      ? await User.findById(idOrKey)
      : await User.findOne({ email: idOrKey });

    if (!user) return res.status(404).json({ message: "Kullanıcı bulunamadı" });

    const { firstName, lastName, phone, role } = req.body;

    if (firstName !== undefined) {
      const v = String(firstName).trim();
      if (!v)
        return res.status(400).json({ message: "Ad boş olamaz" });
      user.firstName = v;
    }

    if (lastName !== undefined) {
      const v = String(lastName).trim();
      if (!v)
        return res.status(400).json({ message: "Soyad boş olamaz" });
      user.lastName = v;
    }

    if (phone !== undefined) {
      user.phone = String(phone).trim();
    }

    if (role !== undefined) {
      const normalized = String(role).toLowerCase();
      if (!["user", "admin"].includes(normalized)) {
        return res.status(400).json({ message: "Geçersiz rol" });
      }
      if (user.role !== normalized) {
        if (user.role === "admin" && normalized !== "admin") {
          const otherAdmins = await User.countDocuments({
            role: "admin",
            _id: { $ne: user._id },
            isDeleted: false,
          });
          if (otherAdmins === 0) {
            return res
              .status(400)
              .json({ message: "En az bir yönetici kalmalı" });
          }
        }
        user.role = normalized;
      }
    }

    await user.save();
    res.json({ user: shapeUser(user) });
  } catch (error) {
    res.status(500).json({ message: error.message || "Kullanıcı güncellenemedi" });
  }
}

/** 🔽 SOFT DELETE */
export async function softDeleteUser(req, res) {
  try {
    const { idOrKey } = req.params;
    const { deletedAlias = "Silinen hesap" } = req.body || {};

    const isId = mongoose.Types.ObjectId.isValid(idOrKey);
    const user = isId
      ? await User.findById(idOrKey)
      : await User.findOne({ email: idOrKey });
    if (!user) return res.status(404).json({ message: "Kullanıcı bulunamadı" });

    if (user.isDeleted) {
      return res.status(200).json({ user: shapeUser(user) }); // zaten silik
    }

    // En son kalan admin kendini silemesin
    if (user.role === "admin") {
      const otherAdmins = await User.countDocuments({
        role: "admin",
        _id: { $ne: user._id },
        isDeleted: false,
      });
      if (otherAdmins === 0) {
        return res
          .status(400)
          .json({ message: "En az bir aktif yönetici kalmalı" });
      }
    }

    user.isDeleted = true;
    user.deletedAt = new Date();
    user.deletedBy = req.userId || null;
    user.deletedAlias = String(deletedAlias).trim() || "Silinen hesap";

    await user.save();
    res.json({ user: shapeUser(user) });
  } catch (error) {
    res.status(500).json({ message: error.message || "Kullanıcı silinemedi" });
  }
}

/** 🔽 RESTORE */
export async function restoreUser(req, res) {
  try {
    const { idOrKey } = req.params;
    const isId = mongoose.Types.ObjectId.isValid(idOrKey);
    const user = isId
      ? await User.findById(idOrKey)
      : await User.findOne({ email: idOrKey });

    if (!user) return res.status(404).json({ message: "Kullanıcı bulunamadı" });
    if (!user.isDeleted) {
      return res.status(200).json({ user: shapeUser(user) }); // zaten aktif
    }

    user.isDeleted = false;
    user.deletedAt = null;
    user.deletedBy = null;
    // deletedAlias'ı tutabiliriz (geçmişi görmek isteyebilirsin), istersen sıfırlarsın.
    await user.save();

    res.json({ user: shapeUser(user) });
  } catch (error) {
    res
      .status(500)
      .json({ message: error.message || "Kullanıcı geri yüklenemedi" });
  }
}

/** Metrikler: aktif/silinmiş ayrı verelim */
async function collectUserMetrics() {
  const now = new Date();
  const currentWindowStart = new Date(now);
  currentWindowStart.setHours(0, 0, 0, 0);
  currentWindowStart.setDate(currentWindowStart.getDate() - 30);

  const previousWindowStart = new Date(currentWindowStart);
  previousWindowStart.setDate(previousWindowStart.getDate() - 30);

  const [
    totalActiveUsers,
    totalDeletedUsers,
    adminUsers,
    newActiveUsersLast30Days,
    previousWindowActiveUsers,
    latestActiveUser,
  ] = await Promise.all([
    User.countDocuments({ isDeleted: false }),
    User.countDocuments({ isDeleted: true }),
    User.countDocuments({ role: "admin", isDeleted: false }),
    User.countDocuments({
      createdAt: { $gte: currentWindowStart },
      isDeleted: false,
    }),
    User.countDocuments({
      createdAt: { $gte: previousWindowStart, $lt: currentWindowStart },
      isDeleted: false,
    }),
    User.findOne({ isDeleted: false }).sort({ createdAt: -1 }).lean(),
  ]);

  const growth = calculateGrowth(
    newActiveUsersLast30Days,
    previousWindowActiveUsers
  );

  return {
    totalUsers: totalActiveUsers,
    deletedUsers: totalDeletedUsers,
    adminUsers,
    newUsersLast30Days: newActiveUsersLast30Days,
    growthRate30Days: growth,
    latestUser: latestActiveUser ? shapeUser(latestActiveUser) : null,
  };
}

function calculateGrowth(current, previous) {
  if (!previous && current) return 100;
  if (!previous) return 0;
  const delta = ((current - previous) / previous) * 100;
  return Number(delta.toFixed(1));
}
