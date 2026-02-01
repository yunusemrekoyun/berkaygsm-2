// backend/controllers/userDetailsController.js
import mongoose from "mongoose";
import User from "../models/User.js";
import UserDetails from "../models/UserDetails.js";
import Product from "../models/Product.js";
import Set from "../models/Set.js";
import {
  uploadBufferToCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinaryUpload.js";
import { shapeUser } from "../utils/userPresenter.js";
import { shapeProduct } from "../utils/productHelpers.js";
import {
  fetchActiveDiscounts,
  computeProductDiscountMap,
  mapDiscountsToSets,
  applyDiscount,
} from "../utils/discountHelpers.js";

// ------------------------------
// Helpers / Shapers
// ------------------------------
function shapeAddress(doc) {
  if (!doc) return null;
  return {
    id: doc._id?.toString?.() || String(doc._id),
    label: doc.label || "",
    fullName: doc.fullName || "",
    phone: doc.phone || "",
    country: doc.country || "",
    city: doc.city || "",
    district: doc.district || "",
    postalCode: doc.postalCode || "",
    addressLine: doc.addressLine || "",
    isDefault: !!doc.isDefault,
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  };
}

function shapeAvatar(avatar) {
  if (!avatar) return null;
  return {
    url: avatar.url,
    publicId: avatar.publicId,
    width: avatar.width,
    height: avatar.height,
    format: avatar.format,
  };
}

function setId(doc) {
  if (!doc) return null;
  return (
    doc._id?.toString?.() ||
    doc.id?.toString?.() ||
    (typeof doc === "string" ? doc : String(doc._id || doc.id || ""))
  );
}

function shapeSet(doc, { discount = null } = {}) {
  if (!doc) return null;

  const basePrice = Number(doc.price) || 0;
  const normalizedDiscount = discount
    ? {
        id: discount.id || discount._id?.toString?.() || String(discount._id),
        name: discount.name,
        percentage: Number(discount.percentage) || 0,
        description: discount.description || "",
      }
    : null;
  const { finalPrice } = applyDiscount(basePrice, normalizedDiscount);

  return {
    id: doc._id,
    name: doc.name,
    slug: doc.slug,
    description: doc.description,
    price: basePrice,
    finalPrice,
    discount: normalizedDiscount,
    hasDiscount: Boolean(normalizedDiscount) && finalPrice !== basePrice,
    show: doc.show,
    stock: doc.stock,
    images: doc.images,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function shapeUserDetails(details, userObj = null) {
  if (!details) return null;
  return {
    id: details._id?.toString?.() || String(details._id),
    user: userObj ? shapeUser(userObj) : shapeUser(details.user),
    avatar: shapeAvatar(details.avatar),
    gender: details.gender || "",
    birthDate: details.birthDate || null,
    addresses: Array.isArray(details.addresses)
      ? details.addresses.map(shapeAddress)
      : [],
    favorites: {
      products: (details.favoriteProducts || []).map(
        (id) => id?.toString?.() || String(id)
      ),
      sets: (details.favoriteSets || []).map(
        (id) => id?.toString?.() || String(id)
      ),
    },
    createdAt: details.createdAt || null,
    updatedAt: details.updatedAt || null,
  };
}

async function ensureDetails(userId) {
  let details = await UserDetails.findOne({ user: userId });
  if (!details) {
    details = await UserDetails.create({ user: userId });
  }
  return details;
}

// ------------------------------
// GET /api/user-details/me
// ------------------------------
export async function getMyDetails(req, res) {
  try {
    const userId = req.userId;
    const [user, details] = await Promise.all([
      User.findById(userId),
      ensureDetails(userId),
    ]);

    res.json({ details: shapeUserDetails(details, user) });
  } catch (error) {
    res
      .status(500)
      .json({ message: error.message || "Unable to fetch details" });
  }
}

// ------------------------------
// PUT /api/user-details/me
// (Kullanıcı temel bilgileri + demografik)
// ------------------------------
export async function updateMyDetails(req, res) {
  try {
    const userId = req.userId;
    const { firstName, lastName, phone, email, gender, birthDate } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Email duplicate kontrolü
    if (email && email !== user.email) {
      const exists = await User.findOne({ email });
      if (exists) {
        return res.status(409).json({ message: "Email already in use" });
      }
      user.email = String(email).trim().toLowerCase();
    }

    if (firstName !== undefined) {
      const v = String(firstName).trim();
      if (!v)
        return res.status(400).json({ message: "First name cannot be empty" });
      user.firstName = v;
    }
    if (lastName !== undefined) {
      const v = String(lastName).trim();
      if (!v)
        return res.status(400).json({ message: "Last name cannot be empty" });
      user.lastName = v;
    }
    if (phone !== undefined) user.phone = String(phone).trim();

    await user.save();

    const details = await ensureDetails(userId);
    if (gender !== undefined) {
      const allowed = ["male", "female", "other", ""];
      const g = String(gender).toLowerCase();
      if (!allowed.includes(g)) {
        return res.status(400).json({ message: "Invalid gender" });
      }
      details.gender = g;
    }
    if (birthDate !== undefined) {
      details.birthDate = birthDate ? new Date(birthDate) : null;
    }
    await details.save();

    res.json({ details: shapeUserDetails(details, user) });
  } catch (error) {
    res
      .status(500)
      .json({ message: error.message || "Unable to update details" });
  }
}

// ------------------------------
// PATCH /api/user-details/me/avatar
// Field: avatar (file)
// ------------------------------
export async function uploadAvatar(req, res) {
  try {
    const userId = req.userId;
    const details = await ensureDetails(userId);

    if (!req.file?.buffer) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // eski avatarı sil
    if (details.avatar?.publicId) {
      try {
        await deleteFromCloudinary(details.avatar.publicId);
      } catch {}
    }

    const result = await uploadBufferToCloudinary(req.file.buffer);
    details.avatar = {
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
    };

    await details.save();
    res.json({ avatar: shapeAvatar(details.avatar) });
  } catch (error) {
    res
      .status(500)
      .json({ message: error.message || "Unable to upload avatar" });
  }
}

// ------------------------------
// Adresler
// ------------------------------

// POST /api/user-details/addresses
export async function createAddress(req, res) {
  try {
    const userId = req.userId;
    const details = await ensureDetails(userId);

    const {
      label = "",
      fullName = "",
      phone = "",
      country = "",
      city = "",
      district = "",
      postalCode = "",
      addressLine = "",
      isDefault = false,
    } = req.body || {};

    const newAddress = {
      label: String(label),
      fullName: String(fullName),
      phone: String(phone),
      country: String(country),
      city: String(city),
      district: String(district),
      postalCode: String(postalCode),
      addressLine: String(addressLine),
      isDefault: !!isDefault,
    };

    // Yeni adres default ise diğerlerini default=false yap
    if (newAddress.isDefault) {
      details.addresses = (details.addresses || []).map((a) => ({
        ...(a.toObject?.() || a),
        isDefault: false,
      }));
    }

    details.addresses.push(newAddress);
    await details.save();

    const created = details.addresses[details.addresses.length - 1];
    res.status(201).json({ address: shapeAddress(created) });
  } catch (error) {
    res.status(500).json({ message: error.message || "Unable to add address" });
  }
}

// PUT /api/user-details/addresses/:addressId
export async function updateAddress(req, res) {
  try {
    const userId = req.userId;
    const { addressId } = req.params;
    const details = await ensureDetails(userId);

    const addr = details.addresses.id(addressId);
    if (!addr) return res.status(404).json({ message: "Address not found" });

    const {
      label,
      fullName,
      phone,
      country,
      city,
      district,
      postalCode,
      addressLine,
      isDefault,
    } = req.body || {};

    if (label !== undefined) addr.label = String(label);
    if (fullName !== undefined) addr.fullName = String(fullName);
    if (phone !== undefined) addr.phone = String(phone);
    if (country !== undefined) addr.country = String(country);
    if (city !== undefined) addr.city = String(city);
    if (district !== undefined) addr.district = String(district);
    if (postalCode !== undefined) addr.postalCode = String(postalCode);
    if (addressLine !== undefined) addr.addressLine = String(addressLine);

    if (isDefault !== undefined) {
      const makeDefault = !!isDefault;
      if (makeDefault) {
        details.addresses = (details.addresses || []).map((a) => ({
          ...(a.toObject?.() || a),
          isDefault: a._id?.toString?.() === addressId,
        }));
      } else {
        addr.isDefault = false;
      }
    }

    await details.save();
    res.json({ address: shapeAddress(addr) });
  } catch (error) {
    res
      .status(500)
      .json({ message: error.message || "Unable to update address" });
  }
}

// DELETE /api/user-details/addresses/:addressId
export async function deleteAddress(req, res) {
  try {
    const userId = req.userId;
    const { addressId } = req.params;
    const details = await ensureDetails(userId);

    const addr = details.addresses.id(addressId);
    if (!addr) return res.status(404).json({ message: "Address not found" });

    addr.deleteOne();
    await details.save();

    res.json({ ok: true });
  } catch (error) {
    res
      .status(500)
      .json({ message: error.message || "Unable to delete address" });
  }
}

// ------------------------------
// Favoriler
// ------------------------------

// GET /api/user-details/favorites
export async function getFavorites(req, res) {
  try {
    const userId = req.userId;
    const details = await ensureDetails(userId);

    const [products, sets] = await Promise.all([
      Product.find({ _id: { $in: details.favoriteProducts || [] } })
        .populate("category")
        .lean(),
      Set.find({ _id: { $in: details.favoriteSets || [] } }).lean(),
    ]);

    const activeDiscounts = await fetchActiveDiscounts();
    const productDiscountMap = activeDiscounts.length
      ? computeProductDiscountMap(activeDiscounts, products)
      : new Map();
    const setDiscountMap = activeDiscounts.length
      ? mapDiscountsToSets(
          activeDiscounts,
          sets.map((set) => setId(set) || "")
        )
      : new Map();

    res.json({
      favorites: {
        products: products.map((product) => {
          const id = product?._id?.toString?.() || "";
          return shapeProduct(product, {
            discount: id ? productDiscountMap.get(id) || null : null,
          });
        }),
        sets: sets.map((set) => {
          const id = setId(set) || "";
          return shapeSet(set, { discount: setDiscountMap.get(id) || null });
        }),
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: error.message || "Unable to fetch favorites" });
  }
}

// POST /api/user-details/favorites/toggle
// Body: { type: "product" | "set", id: "<ObjectId>" }
export async function toggleFavorite(req, res) {
  try {
    const userId = req.userId;
    const { type, id } = req.body || {};

    if (!["product", "set"].includes(String(type))) {
      return res.status(400).json({ message: "Invalid favorite type" });
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const details = await ensureDetails(userId);

    if (type === "product") {
      // opsiyonel: ürün var mı kontrolü
      const exists = await Product.exists({ _id: id });
      if (!exists)
        return res.status(404).json({ message: "Product not found" });

      const idx = details.favoriteProducts.findIndex(
        (x) => String(x) === String(id)
      );
      if (idx >= 0) details.favoriteProducts.splice(idx, 1);
      else details.favoriteProducts.push(id);
    } else {
      const exists = await Set.exists({ _id: id });
      if (!exists) return res.status(404).json({ message: "Set not found" });

      const idx = details.favoriteSets.findIndex(
        (x) => String(x) === String(id)
      );
      if (idx >= 0) details.favoriteSets.splice(idx, 1);
      else details.favoriteSets.push(id);
    }

    await details.save();
    res.json({
      ok: true,
      favorites: {
        productCount: details.favoriteProducts.length,
        setCount: details.favoriteSets.length,
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: error.message || "Unable to toggle favorite" });
  }
}
