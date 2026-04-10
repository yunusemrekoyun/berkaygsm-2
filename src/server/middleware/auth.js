import jwt from "jsonwebtoken";
import User from "../models/User.js";

async function resolveUserFromAuthHeader(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return { token: null, user: null, payload: null };

  const secret = String(process.env.JWT_ACCESS_SECRET || "").trim();
  if (!secret) {
    throw Object.assign(new Error("Kimlik doğrulama yapılandırması eksik"), {
      status: 500,
    });
  }

  const payload = jwt.verify(token, secret);

  const user = await User.findById(payload.sub).select(
    "role isDeleted deletedAlias"
  );

  if (!user) {
    throw Object.assign(new Error("Kullanıcı bulunamadı"), { status: 401 });
  }

  if (user.isDeleted) {
    throw Object.assign(
      new Error(
        user.deletedAlias
          ? `Hesap pasif (${user.deletedAlias})`
          : "Hesap pasif"
      ),
      { status: 403 }
    );
  }

  return { token, user, payload };
}

function attachResolvedUser(req, resolved) {
  if (!resolved?.user) return;
  req.userId = resolved.user._id.toString();
  req.userRole = resolved.user.role || resolved.payload?.role;
  req.user = resolved.user;
}

export async function requireAuth(req, res, next) {
  try {
    const resolved = await resolveUserFromAuthHeader(req);
    if (!resolved?.token) {
      return res.status(401).json({ message: "Token bulunamadı" });
    }
    attachResolvedUser(req, resolved);
    return next();
  } catch (error) {
    return res
      .status(error?.status || 401)
      .json({ message: error?.message || "Geçersiz veya süresi dolmuş token" });
  }
}

export async function optionalAuth(req, res, next) {
  try {
    const resolved = await resolveUserFromAuthHeader(req);
    attachResolvedUser(req, resolved);
    return next();
  } catch {
    return next();
  }
}
