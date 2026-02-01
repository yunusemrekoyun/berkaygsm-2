import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import upload from "../middleware/upload.js";
import {
  createCategory,
  listCategories,
  getCategory,
  updateCategory,
  deleteCategory,
  getCategoryTree,
} from "../controllers/categoryController.js";

const router = Router();

router.get("/", listCategories);
router.get("/tree", getCategoryTree);
router.get("/:idOrSlug", getCategory);

router.post(
  "/",
  requireAuth,
  requireRole("admin"),
  upload.single("image"),
  createCategory
);
router.patch(
  "/:idOrSlug",
  requireAuth,
  requireRole("admin"),
  upload.single("image"),
  updateCategory
);
router.delete("/:idOrSlug", requireAuth, requireRole("admin"), deleteCategory);

export default router;
