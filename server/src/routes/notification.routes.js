import express from "express";
import {
  getNotifications,
  getNotificationRedirect,
  markAsRead,
  getUnreadCount
} from "../controllers/notification.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

// 📥 Get all notifications
router.get("/", protect, getNotifications);

router.get("/:id/redirect", protect, getNotificationRedirect);

// 👁 Mark as read
router.patch("/:id/read", protect, markAsRead);

// 🔢 Unread count
router.get("/unread/count", protect, getUnreadCount);

export default router;