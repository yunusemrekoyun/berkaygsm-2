import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  createOrder,
  myOrders,
  getOrder,
  listOrders,
  adminGetOrder,
  updateOrderStatus,
} from "../controllers/orderController.js";
import {
  createPayPalCheckout,
  capturePayPalCheckout,
} from "../controllers/paymentController.js";
import { requireRole } from "../middleware/roles.js";
import { validateBody } from "../middleware/validate.js";
import {
  orderCreateSchema,
  paypalCreateSchema,
  paypalCaptureSchema,
} from "../validation/schemas.js";

const router = Router();

router.post(
  "/paypal/create",
  requireAuth,
  validateBody(paypalCreateSchema),
  createPayPalCheckout
);
router.post(
  "/paypal/capture",
  requireAuth,
  validateBody(paypalCaptureSchema),
  capturePayPalCheckout
);
router.post(
  "/",
  requireAuth,
  validateBody(orderCreateSchema),
  createOrder
);
router.get("/mine", requireAuth, myOrders);
router.get(
  "/admin",
  requireAuth,
  requireRole("admin"),
  listOrders
);
router.get(
  "/admin/:id",
  requireAuth,
  requireRole("admin"),
  adminGetOrder
);
router.patch(
  "/admin/:id/status",
  requireAuth,
  requireRole("admin"),
  updateOrderStatus
);
router.get("/:id", requireAuth, getOrder);

export default router;
