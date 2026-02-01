import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import {
  getPublicTheme,
  getManageTheme,
  upsertTheme,
} from "../controllers/themeController.js";

const router = Router();

// Public
router.get("/", getPublicTheme);

// Admin
router.get("/manage", requireAuth, requireRole("admin"), getManageTheme);
router.put("/", requireAuth, requireRole("admin"), upsertTheme);

export default router;
