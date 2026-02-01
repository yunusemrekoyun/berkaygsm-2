// backend/routes/products.js
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import {
  createProduct,
  listProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  listProductSets,
} from "../controllers/productController.js";
import { upload } from "../middleware/upload.js"; // ← tek noktadan multer (memoryStorage)

const router = Router();
const adminGuard = [requireAuth, requireRole("admin")];

// Liste
router.get("/", listProducts);

// Oluştur (opsiyonel görsel upload)
router.post("/", adminGuard, upload.array("images", 8), createProduct);

// Detay (id veya slug)
router.get("/:idOrSlug/sets", listProductSets);

router.get("/:idOrSlug", getProduct);

// Güncelle (opsiyonel görsel ekleme/silme)
router.put(
  "/:idOrSlug",
  adminGuard,
  upload.array("images", 8),
  updateProduct
);

// Sil
router.delete("/:idOrSlug", adminGuard, deleteProduct);

export default router;
