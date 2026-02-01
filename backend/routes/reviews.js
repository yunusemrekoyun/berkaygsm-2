import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import {
  listApprovedForProduct,
  productReviewStats,
  createReview,
  listPendingReviews,
  approveReview,
  deleteReview,
  listAdminReviews,
  reviewSummary,
  listApprovedForSet,
  setReviewStats,
  listHomeFeaturedReviews,
} from "../controllers/reviewController.js";

const router = Router();

/** Public product endpoints */
router.get("/product/:idOrSlug", listApprovedForProduct);
router.get("/product/:idOrSlug/stats", productReviewStats);
router.get("/set/:idOrSlug", listApprovedForSet);
router.get("/set/:idOrSlug/stats", setReviewStats);
router.get("/home", listHomeFeaturedReviews);
/** Authenticated user creates a review (goes to pending) */
router.post("/", requireAuth, createReview);

/** Admin moderation */
router.get("/summary", requireAuth, requireRole("admin"), reviewSummary);
router.get("/pending", requireAuth, requireRole("admin"), listPendingReviews);
router.get("/", requireAuth, requireRole("admin"), listAdminReviews);
router.patch("/:id/approve", requireAuth, requireRole("admin"), approveReview);
router.delete("/:id", requireAuth, requireRole("admin"), deleteReview);

export default router;
