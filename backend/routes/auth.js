// backend/routes/auth.js
import { Router } from "express";
import {
  register,
  login,
  refresh,
  logout,
  me,
} from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";
import {
  refreshLimiter,
  strictLimiter,
} from "../middleware/rateLimiters.js";

const router = Router();

router.post("/register", strictLimiter, register);
router.post("/login", strictLimiter, login);
router.post("/refresh", refreshLimiter, refresh);
router.post("/logout", refreshLimiter, logout);
router.get("/me", requireAuth, me);

export default router;
