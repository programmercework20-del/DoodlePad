import Notification from "../models/Notification.js";
import Comment from "../models/Comment.js";
import User from "../models/User.js";
import Post from "../models/Post.js";


// ✅ GET ALL NOTIFICATIONS
export const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;

    const notifications = await Notification.findAll({
      where: { receiverId: userId },
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

    res.json({
      success: true,
      notifications
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch notifications" });
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

    await Notification.update(
      { isRead: true },
      { where: { id } }
    );

    res.json({
      success: true,
      message: "Marked as read"
    });

  } catch (error) {
    res.status(500).json({ message: "Failed to update" });
  }
};


// ✅ GET UNREAD COUNT (VERY IMPORTANT FOR UI BADGE)
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;

    const count = await Notification.count({
      where: {
        receiverId: userId,
        isRead: false
      }
    });

    res.json({
      success: true,
      unreadCount: count
    });

  } catch (error) {
    res.status(500).json({ message: "Failed to get count" });
  }
};