import express from "express";
import {
  getNotifications,
  getMessageNotifications,
  getNotificationRedirect,
  markAsRead,
  getUnreadCount,
  getMessageUnreadCount
} from "../controllers/notification.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

// 📥 Get all notifications (excluding messages)
router.get("/", protect, getNotifications);

// 💬 Get message notifications (for chat tab)
router.get("/messages/list", protect, getMessageNotifications);

// 🔢 Get unread count (excluding messages)
router.get("/unread/count", protect, getUnreadCount);

// 💬 Get message unread count (for chat badge)
router.get("/messages/unread/count", protect, getMessageUnreadCount);

// Redirect logic
router.get("/:id/redirect", protect, getNotificationRedirect);

// 👁 Mark as read
router.patch("/:id/read", protect, markAsRead);

export default router;