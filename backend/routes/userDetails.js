// backend/routes/userDetails.js
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import upload from "../middleware/upload.js";
import {
  getMyDetails,
  updateMyDetails,
  uploadAvatar,
  createAddress,
  updateAddress,
  deleteAddress,
  getFavorites,
  toggleFavorite,
} from "../controllers/userDetailsController.js";

const router = Router();

router.use(requireAuth);

// profil + detaylar
router.get("/", getMyDetails);
router.get("/me", getMyDetails);
router.put("/me", updateMyDetails);

// avatar upload (field name: avatar)
router.patch("/me/avatar", upload.single("avatar"), uploadAvatar);

// adresler
router.post("/addresses", createAddress);
router.put("/addresses/:addressId", updateAddress);
router.delete("/addresses/:addressId", deleteAddress);

// favoriler
router.get("/favorites", getFavorites);
router.post("/favorites/toggle", toggleFavorite);

export default router;
