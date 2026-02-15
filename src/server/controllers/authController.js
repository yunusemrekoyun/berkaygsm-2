import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import UserDetails from "../models/UserDetails.js";
import { shapeUser } from "../utils/userPresenter.js";
import { issueAutoCouponsForNewUser } from "../utils/couponEngine.js";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || "15m";
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || "7d";

const resolveSameSite = (value = "strict") => {
  const normalized = String(value).trim().toLowerCase();
  if (["strict", "lax", "none"].includes(normalized)) return normalized;
  return "strict";
};

const secureCookieDefault =
  process.env.COOKIE_SECURE === "false"
    ? false
    : process.env.COOKIE_SECURE === "true"
    ? true
    : process.env.NODE_ENV !== "development";

const sameSiteDefault = resolveSameSite(process.env.COOKIE_SAMESITE || "strict");

function signAccessToken(payload) {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES });
}

function setRefreshCookie(res, token) {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: secureCookieDefault,
    sameSite: sameSiteDefault,
    path: "/api/auth/refresh",
    maxAge: 1000 * 60 * 60 * 24 * 30,
  });
}

/** POST /api/auth/register */
export const register = async (req, res) => {
  const { firstName, lastName, email, phone, password, role } = req.body;
  if (!firstName || !lastName || !email || !password)
    return res.status(400).json({ message: "Zorunlu alanlar eksik" });

  const exists = await User.findOne({ email });
  if (exists) return res.status(409).json({ message: "E-posta zaten kullanılıyor" });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    firstName,
    lastName,
    email,
    phone,
    passwordHash,
    role: role && ["user", "admin"].includes(role) ? role : "user",
  });
  await UserDetails.create({ user: user._id });

  const accessToken = signAccessToken({ sub: user._id, role: user.role });
  const refreshToken = signRefreshToken({ sub: user._id, role: user.role });

  user.refreshToken = refreshToken;
  await user.save();

  try {
    await issueAutoCouponsForNewUser(user._id?.toString?.() || user._id);
  } catch (error) {
    console.error("Auto coupon assignment failed on register", {
      userId: user._id?.toString?.() || null,
      error: error?.message || String(error),
    });
  }

  setRefreshCookie(res, refreshToken);
  res
    .status(201)
    .json({ user: shapeUser(user), accessToken, expiresIn: ACCESS_EXPIRES });
};

/** POST /api/auth/login */
export const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: "Giriş bilgileri eksik" });

  const user = await User.findOne({ email });
  if (!user)
    return res.status(401).json({ message: "E-posta veya şifre hatalı" });

  // 🚫 Silinmiş hesap login yapamaz
  if (user.isDeleted) {
    return res.status(403).json({
      message: user.deletedAlias
        ? `Hesap pasif (${user.deletedAlias})`
        : "Hesap pasif",
    });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok)
    return res.status(401).json({ message: "E-posta veya şifre hatalı" });

  const accessToken = signAccessToken({ sub: user._id, role: user.role });
  const refreshToken = signRefreshToken({ sub: user._id, role: user.role });

  user.refreshToken = refreshToken; // rotate
  await user.save();

  setRefreshCookie(res, refreshToken);
  res.json({ user: shapeUser(user), accessToken, expiresIn: ACCESS_EXPIRES });
};

/** POST /api/auth/refresh */
export const refresh = async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) return res.status(401).json({ message: "Refresh token yok" });

  try {
    const payload = jwt.verify(token, REFRESH_SECRET);
    const user = await User.findById(payload.sub);

    if (!user || user.refreshToken !== token)
      return res.status(401).json({ message: "Geçersiz refresh token" });

    // 🚫 Silinmiş hesap token yenileyemez
    if (user.isDeleted) {
      return res.status(403).json({ message: "Hesap pasif" });
    }

    const newAccess = signAccessToken({ sub: user._id, role: user.role });
    const newRefresh = signRefreshToken({ sub: user._id, role: user.role });

    user.refreshToken = newRefresh; // rotate
    await user.save();

    setRefreshCookie(res, newRefresh);
    res.json({ accessToken: newAccess, expiresIn: ACCESS_EXPIRES });
  } catch (e) {
    return res.status(401).json({ message: "Token yenileme başarısız" });
  }
};

/** POST /api/auth/logout */
export const logout = async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (token) {
    try {
      const payload = jwt.verify(token, REFRESH_SECRET);
      const user = await User.findById(payload.sub);
      if (user) {
        user.refreshToken = null;
        await user.save();
      }
    } catch {
      // ignore invalid token
    }
  }
  res.clearCookie("refreshToken", {
    path: "/api/auth/refresh",
    sameSite: sameSiteDefault,
    secure: secureCookieDefault,
  });
  res.json({ ok: true });
};

/** GET /api/auth/me (Access Token gerekli) */
export const me = async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ message: "Kullanıcı bulunamadı" });

  // 🚫 Soft-deleted kullanıcıya 403 dön
  if (user.isDeleted) {
    return res.status(403).json({
      message: user.deletedAlias
        ? `Hesap pasif (${user.deletedAlias})`
        : "Hesap pasif",
    });
  }

  res.json({ user: shapeUser(user) });
};
