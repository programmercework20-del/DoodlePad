import Notification from "../models/Notification.js";
import Comment from "../models/Comment.js";
import User from "../models/User.js";
import Post from "../models/Post.js";
import { Op } from "sequelize";
import redisClient from "../config/redis.js";

// ✅ GET ALL NOTIFICATIONS (Excluding messages)
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
        type: { [Op.notIn]: ["MESSAGE"] }
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

    // 🚀 Set Cache
    if (redisClient?.isReady) {
      await redisClient.setEx(cacheKey, 120, JSON.stringify(notifications));
    }

    res.json({
      success: true,
      notifications
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
};

// ✅ GET MESSAGE NOTIFICATIONS (For Chat Tab)
export const getMessageNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const cacheKey = `message_notifications:${userId}`;

    // 🚀 Redis Check
    if (redisClient?.isReady) {
      const cached = await redisClient.get(cacheKey);
      if (cached) return res.json({ success: true, notifications: JSON.parse(cached) });
    }

    const notifications = await Notification.findAll({
      where: {
        receiverId: userId,
        type: "MESSAGE"
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

    // 🚀 Set Cache
    if (redisClient?.isReady) {
      await redisClient.setEx(cacheKey, 120, JSON.stringify(notifications));
    }

    return res.json({
      success: true,
      notifications
    });

  } catch (error) {
    console.error("GET MESSAGE NOTIFICATION ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch message notifications" });
  }
};

export const getNotificationRedirect = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const notification = await Notification.findOne({
      where: { id, receiverId: userId }
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found"
      });
    }

    let exists = true;
    let parentId = null;
    let conversationId = null;

    // 🚀 Handle MESSAGE Redirect
    if (notification.type === "MESSAGE") {
      if (notification.conversationId) {
        conversationId = notification.conversationId;
        exists = true;
      } else {
        exists = false;
      }
    }

    // 🚀 Handle Post Redirect
    if (notification.postId) {
      const post = await Post.findByPk(notification.postId);
      if (!post) exists = false;
    }

    // 🚀 Handle Comment/Reply Redirect
    if (notification.commentId && notification.type !== "MESSAGE") {
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
      conversationId,
      doodleRequestId: notification.doodleRequestId,
      exists
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to resolve notification redirect"
    });
  }
};

// ✅ MARK SINGLE AS READ
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const notification = await Notification.findOne({ where: { id, receiverId: userId } });
    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    await notification.update({ isRead: true });

    // Clear cache
    if (redisClient?.isReady) {
      await redisClient.del(`notifications:${userId}`);
      await redisClient.del(`message_notifications:${userId}`);
      await redisClient.del(`unread_count:${userId}`);
      await redisClient.del(`message_unread_count:${userId}`);
    }

    res.json({
      success: true,
      message: "Marked as read"
    });

  } catch (error) {
    res.status(500).json({ message: "Failed to update" });
  }
};

// ✅ GET UNREAD COUNT (Excluding messages)
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
        type: { [Op.notIn]: ["MESSAGE"] }
      }
    });

    if (redisClient?.isReady) {
      await redisClient.setEx(cacheKey, 60, count.toString());
    }

    res.json({
      success: true,
      unreadCount: count
    });

  } catch (error) {
    res.status(500).json({ message: "Failed to get count" });
  }
};

// ✅ GET MESSAGE UNREAD COUNT (For Chat Badge)
export const getMessageUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;
    const cacheKey = `message_unread_count:${userId}`;

    // Redis Check
    if (redisClient?.isReady) {
      const cached = await redisClient.get(cacheKey);
      if (cached) return res.json({ success: true, unreadCount: parseInt(cached) });
    }

    const count = await Notification.count({
      where: {
        receiverId: userId,
        isRead: false,
        type: "MESSAGE"
      }
    });

    if (redisClient?.isReady) {
      await redisClient.setEx(cacheKey, 60, count.toString());
    }

    return res.json({ success: true, unreadCount: count });

  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to get message unread count" });
  }
};