import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import { upload } from "../middleware/upload.js";
import {
  listActiveCampaigns,
  listCampaignsAdmin,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  reorderCampaigns,
  resolveCampaign,
  getCampaign,
} from "../controllers/campaignController.js";

const router = Router();

router.get("/", listActiveCampaigns);
router.get("/:id/resolve", resolveCampaign);

router.use(requireAuth, requireRole("admin"));

router.get("/manage", listCampaignsAdmin);
router.get("/:id", getCampaign);
router.post("/", upload.single("image"), createCampaign);
router.put("/:id", upload.single("image"), updateCampaign);
router.delete("/:id", deleteCampaign);
router.post("/reorder", reorderCampaigns);

export default router;
