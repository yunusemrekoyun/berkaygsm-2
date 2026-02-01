// backend/routes/shippingReturns.js
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import {
  getPublicShippingReturns,
  getManageShippingReturns,
  upsertShippingReturns,
} from "../controllers/shippingReturnsController.js";

const router = Router();

// Public
router.get("/", getPublicShippingReturns);

// Admin
router.get(
  "/manage",
  requireAuth,
  requireRole("admin"),
  getManageShippingReturns
);
router.put("/", requireAuth, requireRole("admin"), upsertShippingReturns);

export default router;
