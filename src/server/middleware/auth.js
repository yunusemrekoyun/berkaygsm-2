import jwt from "jsonwebtoken";
import User from "../models/User.js";

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Token bulunamadı" });

  const secret = String(process.env.JWT_ACCESS_SECRET || "").trim();
  if (!secret) {
    return res
      .status(500)
      .json({ message: "Kimlik doğrulama yapılandırması eksik" });
  }

  try {
    const payload = jwt.verify(token, secret);

    const user = await User.findById(payload.sub).select(
      "role isDeleted deletedAlias"
    );

    if (!user)
      return res.status(401).json({ message: "Kullanıcı bulunamadı" });

    if (user.isDeleted) {
      return res.status(403).json({
        message: user.deletedAlias
          ? `Hesap pasif (${user.deletedAlias})`
          : "Hesap pasif",
      });
    }

    req.userId = user._id.toString();
    req.userRole = user.role || payload.role;
    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ message: "Geçersiz veya süresi dolmuş token" });
  }
}
