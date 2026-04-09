import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import UserDetails from "../models/UserDetails.js";
import { shapeUser } from "../utils/userPresenter.js";
import { issueAutoCouponsForNewUser } from "../utils/couponEngine.js";
import { validatePasswordPolicy } from "../../utils/passwordPolicy.js";
import {
  buildRefreshSessionRecord,
  findRefreshSession,
  generateRefreshSessionId,
  pruneRefreshSessions,
  removeRefreshSession,
  upsertRefreshSession,
} from "../utils/refreshSessions.js";

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

function getAccessTokenSecret() {
  const secret = String(process.env.JWT_ACCESS_SECRET || "").trim();
  if (!secret) {
    throw new Error("JWT_ACCESS_SECRET yapılandırılmamış");
  }
  return secret;
}

function getRefreshTokenSecret() {
  const secret = String(process.env.JWT_REFRESH_SECRET || "").trim();
  if (!secret) {
    throw new Error("JWT_REFRESH_SECRET yapılandırılmamış");
  }
  return secret;
}

function getRefreshCookieSameSite() {
  // External payment providers redirect users back to the site after payment.
  // Strict cookies are not reliable for that return leg, so auth refresh must
  // stay at least Lax even if the broader site policy is configured as Strict.
  if (sameSiteDefault === "strict") return "lax";
  return sameSiteDefault;
}

function parseBooleanLike(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function signAccessToken(payload) {
  return jwt.sign(payload, getAccessTokenSecret(), { expiresIn: ACCESS_EXPIRES });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, getRefreshTokenSecret(), { expiresIn: REFRESH_EXPIRES });
}

function clearRefreshCookie(res) {
  const common = {
    sameSite: getRefreshCookieSameSite(),
    secure: secureCookieDefault,
    httpOnly: true,
  };
  res.clearCookie("refreshToken", {
    ...common,
    path: "/api/auth",
  });
  res.clearCookie("refreshToken", {
    ...common,
    path: "/api/auth/refresh",
  });
}

function setRefreshCookie(res, token) {
  clearRefreshCookie(res);
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: secureCookieDefault,
    sameSite: getRefreshCookieSameSite(),
    path: "/api/auth",
    maxAge: 1000 * 60 * 60 * 24 * 30,
  });
}

function decodeRefreshExpiry(token) {
  const decoded = jwt.decode(token);
  const expSeconds = Number(decoded?.exp || 0);
  if (!Number.isFinite(expSeconds) || expSeconds <= 0) return null;
  return new Date(expSeconds * 1000);
}

function attachRefreshSession(user, { sid, token, now = new Date() }) {
  const sessions = pruneRefreshSessions(user.refreshSessions || [], {
    now,
  });
  user.refreshSessions = upsertRefreshSession(
    sessions,
    buildRefreshSessionRecord({
      sid,
      token,
      expiresAt: decodeRefreshExpiry(token),
      createdAt: now,
      lastUsedAt: now,
    }),
    { now }
  );
  user.refreshToken = null;
}

function buildRefreshTokenPayload(user, sid) {
  return {
    sub: user._id,
    role: user.role,
    sid,
  };
}

async function issueSessionTokens(user) {
  const sid = generateRefreshSessionId();
  const accessToken = signAccessToken({ sub: user._id, role: user.role });
  const refreshToken = signRefreshToken(buildRefreshTokenPayload(user, sid));
  attachRefreshSession(user, { sid, token: refreshToken });
  await user.save();
  return { accessToken, refreshToken };
}

/** POST /api/auth/register */
export const register = async (req, res) => {
  const {
    firstName,
    lastName,
    email,
    phone,
    password,
    maintenanceAnnouncementsEnabled,
  } = req.body;
  if (!firstName || !lastName || !email || !password)
    return res.status(400).json({ message: "Zorunlu alanlar eksik" });

  const passwordCheck = validatePasswordPolicy(password);
  if (!passwordCheck.ok) {
    return res.status(400).json({ message: passwordCheck.message });
  }

  const exists = await User.findOne({ email });
  if (exists) return res.status(409).json({ message: "E-posta zaten kullanılıyor" });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    firstName,
    lastName,
    email,
    phone,
    maintenanceAnnouncementsEnabled:
      maintenanceAnnouncementsEnabled !== undefined
        ? parseBooleanLike(maintenanceAnnouncementsEnabled, true)
        : true,
    passwordHash,
    role: "user",
  });
  await UserDetails.create({ user: user._id });

  const { accessToken, refreshToken } = await issueSessionTokens(user);

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

  const { accessToken, refreshToken } = await issueSessionTokens(user);

  setRefreshCookie(res, refreshToken);
  res.json({ user: shapeUser(user), accessToken, expiresIn: ACCESS_EXPIRES });
};

/** POST /api/auth/refresh */
export const refresh = async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) return res.status(401).json({ message: "Refresh token yok" });

  try {
    const payload = jwt.verify(token, getRefreshTokenSecret());
    const user = await User.findById(payload.sub);

    if (!user)
      return res.status(401).json({ message: "Geçersiz refresh token" });

    const now = new Date();
    const sessions = pruneRefreshSessions(user.refreshSessions || [], { now });
    const matchedSession = findRefreshSession(sessions, {
      sid: payload?.sid,
      token,
      now,
    });
    const legacyMatch = user.refreshToken === token;

    if (!matchedSession && !legacyMatch)
      return res.status(401).json({ message: "Geçersiz refresh token" });

    // 🚫 Silinmiş hesap token yenileyemez
    if (user.isDeleted) {
      return res.status(403).json({ message: "Hesap pasif" });
    }

    const sid =
      matchedSession?.sid ||
      (typeof payload?.sid === "string" && payload.sid.trim()) ||
      generateRefreshSessionId();
    const newAccess = signAccessToken({ sub: user._id, role: user.role });
    const newRefresh = signRefreshToken(buildRefreshTokenPayload(user, sid));

    user.refreshSessions = upsertRefreshSession(
      sessions,
      buildRefreshSessionRecord({
        sid,
        token: newRefresh,
        expiresAt: decodeRefreshExpiry(newRefresh),
        createdAt: matchedSession?.createdAt || now,
        lastUsedAt: now,
      }),
      { now }
    );
    user.refreshToken = null;
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
      const payload = jwt.verify(token, getRefreshTokenSecret());
      const user = await User.findById(payload.sub);
      if (user) {
        user.refreshSessions = removeRefreshSession(user.refreshSessions || [], {
          sid: payload?.sid,
          token,
        });
        if (user.refreshToken === token) {
          user.refreshToken = null;
        }
        await user.save();
      }
    } catch {
      // ignore invalid token
    }
  }
  clearRefreshCookie(res);
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
