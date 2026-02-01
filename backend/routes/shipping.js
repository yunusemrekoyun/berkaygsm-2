import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import {
  getShippingConfig,
  updateShippingConfig,
} from "../controllers/shippingController.js";

const router = Router();

router.get("/", getShippingConfig);
router.put("/", requireAuth, requireRole("admin"), updateShippingConfig);

export default router;
