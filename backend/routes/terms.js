// backend/routes/terms.js
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import {
  getPublicTerms,
  getManageTerms,
  upsertTerms,
} from "../controllers/termsController.js";

const router = Router();

router.get("/", getPublicTerms);
router.get("/manage", requireAuth, requireRole("admin"), getManageTerms);
router.put("/", requireAuth, requireRole("admin"), upsertTerms);

export default router;
