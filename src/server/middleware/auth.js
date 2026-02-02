import jwt from "jsonwebtoken";
import User from "../models/User.js";

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "No token" });

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    const user = await User.findById(payload.sub).select(
      "role isDeleted deletedAlias"
    );

    if (!user)
      return res.status(401).json({ message: "User not found" });

    if (user.isDeleted) {
      return res.status(403).json({
        message: user.deletedAlias
          ? `Account is deactivated (${user.deletedAlias})`
          : "Account is deactivated",
      });
    }

    req.userId = user._id.toString();
    req.userRole = payload.role || user.role;
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}
