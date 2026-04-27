import Notification from "../models/Notification.js";
import Comment from "../models/Comment.js";
import User from "../models/User.js";
import Post from "../models/Post.js";
import { Op } from "sequelize";
import redisClient from "../../config/redis.js";

// ============================================================
// GET NOTIFICATIONS (With Redis Cache & Exclusion Logic)
// ============================================================
export const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const cacheKey = `notifications:${userId}`;

    // 🚀 Redis Check
    if (redisClient?.isReady) {
      const cached = await redisClient.get(cacheKey);
      if (cached) return res.json({ success: true, notifications: JSON.parse(cached) });
    }

    const notifications = await Notification.findAll({
      where: {
        receiverId: userId,
        // Exclude specific types that are handled by other tabs (like Chats)
        type: {
          [Op.notIn]: ["MESSAGE", "FOLLOW_REQUEST", "FOLLOW_ACCEPTED"]
        }
      },
      include: [
        {
          model: User,
          as: "sender",
          attributes: ["id", "username", "profilePhoto"]
        }
      ],
      order: [["createdAt", "DESC"]],
      limit: 50
    });

    // 🚀 Set Cache (Short duration - 2 minutes)
    if (redisClient?.isReady) {
      await redisClient.setEx(cacheKey, 120, JSON.stringify(notifications));
    }

    return res.json({
      success: true,
      notifications
    });

  } catch (error) {
    console.error("GET NOTIFICATION ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch notifications" });
  }
};

// ============================================================
// GET UNREAD COUNT (UI Badge Logic)
// ============================================================
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;
    const cacheKey = `unread_count:${userId}`;

    // Redis Check
    if (redisClient?.isReady) {
      const cached = await redisClient.get(cacheKey);
      if (cached) return res.json({ success: true, unreadCount: parseInt(cached) });
    }

    const count = await Notification.count({
      where: {
        receiverId: userId,
        isRead: false,
        // Match the same filtering as the main list
        type: { [Op.notIn]: ["MESSAGE", "FOLLOW_REQUEST", "FOLLOW_ACCEPTED"] }
      }
    });

    if (redisClient?.isReady) {
      await redisClient.setEx(cacheKey, 60, count.toString());
    }

    return res.json({ success: true, unreadCount: count });

  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to get count" });
  }
};

// ============================================================
// REDIRECT LOGIC (Resolve post/comment existence)
// ============================================================
export const getNotificationRedirect = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const notification = await Notification.findOne({
      where: { id, receiverId: userId }
    });

    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    let exists = true;
    let parentId = null;

    if (notification.postId) {
      const post = await Post.findByPk(notification.postId);
      if (!post) exists = false;
    }

    if (notification.commentId) {
      const comment = await Comment.findByPk(notification.commentId);
      if (!comment) {
        exists = false;
      } else {
        parentId = comment.parentId;
      }
    }

    return res.json({
      success: true,
      type: notification.type,
      postId: notification.postId,
      commentId: notification.commentId,
      parentId,
      doodleRequestId: notification.doodleRequestId,
      exists
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Failed to resolve redirect" });
  }
};

// ============================================================
// MARK AS READ (Single or All)
// ============================================================
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (id === "all") {
      await Notification.update({ isRead: true }, { where: { receiverId: userId } });
    } else {
      await Notification.update({ isRead: true }, { where: { id, receiverId: userId } });
    }

    // 🚀 Clear Cache after update
    if (redisClient?.isReady) {
      await redisClient.del(`notifications:${userId}`);
      await redisClient.del(`unread_count:${userId}`);
    }

    return res.json({ success: true, message: "Status updated" });

  } catch (error) {
    return res.status(500).json({ success: false, message: "Update failed" });
  }
};