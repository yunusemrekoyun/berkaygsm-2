import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import upload from "../middleware/upload.js";
import {
  getContact,
  updateContact,
  submitMessage,
  listMessages,
  updateMessageStatus,
  deleteMessage,
} from "../controllers/contactController.js";

const router = Router();

/** Public content */
router.get("/", getContact);

/** Public form submit (isteğe bağlı auth; genellikle anon da olur) */
router.post("/messages", submitMessage);

/** Admin content manage */
router.put(
  "/",
  requireAuth,
  requireRole("admin"),
  upload.single("heroImage"),
  updateContact
);

/** Admin messages manage */
router.get("/messages", requireAuth, requireRole("admin"), listMessages);
router.patch(
  "/messages/:id",
  requireAuth,
  requireRole("admin"),
  updateMessageStatus
);
router.delete(
  "/messages/:id",
  requireAuth,
  requireRole("admin"),
  deleteMessage
);

export default router;
