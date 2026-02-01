// backend/routes/faq.js
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import {
  getFaqPublic,
  getFaqManage,
  upsertFaq,
} from "../controllers/faqController.js";

const router = Router();

/** Public */
router.get("/", getFaqPublic);

/** Admin manage */
router.get("/manage", requireAuth, requireRole("admin"), getFaqManage);
router.put("/", requireAuth, requireRole("admin"), upsertFaq);

export default router;
