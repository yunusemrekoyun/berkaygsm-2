import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import {
  listDiscounts,
  createDiscount,
  updateDiscount,
  deleteDiscount,
} from "../controllers/discountController.js";

const router = Router();

router.use(requireAuth, requireRole("admin"));

router.get("/", listDiscounts);
router.post("/", createDiscount);
router.patch("/:id", updateDiscount);
router.delete("/:id", deleteDiscount);

export default router;
