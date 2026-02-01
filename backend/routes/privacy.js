// backend/routes/privacy.js
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import {
  getPublicPrivacy,
  getManagePrivacy,
  upsertPrivacy,
} from "../controllers/privacyController.js";

const router = Router();

router.get("/", getPublicPrivacy);
router.get("/manage", requireAuth, requireRole("admin"), getManagePrivacy);
router.put("/", requireAuth, requireRole("admin"), upsertPrivacy);

export default router;
