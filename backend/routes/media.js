import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import { upload } from "../middleware/upload.js";
import { mediaUploadLimiter } from "../middleware/rateLimiters.js";
import {
  getCloudinaryUsage,
  listCloudinaryResources,
  deleteCloudinaryResource,
  uploadMediaAsset,
} from "../controllers/mediaController.js";

const router = Router();
const adminGuard = [requireAuth, requireRole("admin")];

router.get("/usage", ...adminGuard, getCloudinaryUsage);

router.get("/resources", ...adminGuard, listCloudinaryResources);

router.delete("/resources/:publicId", ...adminGuard, deleteCloudinaryResource);

router.post(
  "/upload",
  ...adminGuard,
  mediaUploadLimiter,
  upload.single("file"),
  uploadMediaAsset
);

export default router;
