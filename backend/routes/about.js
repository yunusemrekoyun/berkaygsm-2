import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import upload from "../middleware/upload.js";
import { getAbout, updateAbout } from "../controllers/aboutController.js";

const router = Router();

// Public
router.get("/", getAbout);

// Admin – çoklu alan upload
router.put(
  "/",
  requireAuth,
  requireRole("admin"),
  upload.fields([
    { name: "heroImage", maxCount: 1 },
    { name: "leftImage", maxCount: 1 },
    { name: "materialsImage", maxCount: 1 },
  ]),
  updateAbout
);

// PATCH de istersen aynı handler
router.patch(
  "/",
  requireAuth,
  requireRole("admin"),
  upload.fields([
    { name: "heroImage", maxCount: 1 },
    { name: "leftImage", maxCount: 1 },
    { name: "materialsImage", maxCount: 1 },
  ]),
  updateAbout
);

export default router;
