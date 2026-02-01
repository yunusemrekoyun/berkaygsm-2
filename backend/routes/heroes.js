// backend/routes/heroRoutes.js
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import { uploadHeroMedia } from "../middleware/upload.js";
import {
  listHeroes,
  createHero,
  getHero,
  updateHero,
  deleteHero,
  reorderHeroes,
} from "../controllers/heroController.js";

const router = Router();

router.get("/", listHeroes);

router.post(
  "/",
  requireAuth,
  requireRole("admin"),
  uploadHeroMedia.single("media"), // << büyük limit + video
  createHero
);

router.get(
  "/:id",
  requireAuth,
  requireRole("admin"),
  getHero
);

router.put(
  "/:id",
  requireAuth,
  requireRole("admin"),
  uploadHeroMedia.single("media"), // << büyük limit + video
  updateHero
);

router.delete("/:id", requireAuth, requireRole("admin"), deleteHero);

// sıralama
router.post("/reorder", requireAuth, requireRole("admin"), reorderHeroes);

export default router;
