// backend/routes/sets.js
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import { upload } from "../middleware/upload.js";
import {
  createSet,
  listSets,
  getSet,
  updateSet,
  deleteSet,
} from "../controllers/setController.js";

const router = Router();
const adminGuard = [requireAuth, requireRole("admin")];

// Liste
router.get("/", listSets);

// Oluştur (opsiyonel görsel upload)
router.post("/", adminGuard, upload.array("images", 8), createSet);

// Detay (id veya slug)
router.get("/:idOrSlug", getSet);

// Güncelle
router.put(
  "/:idOrSlug",
  adminGuard,
  upload.array("images", 8),
  updateSet
);

// Sil
router.delete("/:idOrSlug", adminGuard, deleteSet);

export default router;
