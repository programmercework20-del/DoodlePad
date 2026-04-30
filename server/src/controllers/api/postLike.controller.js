import Post from "../../models/Post.js";
import PostLike from "../../models/PostLike.js";
import { createNotification } from "../../services/notification.service.js";
import User from "../../models/User.js";
import redisClient from "../../config/redis.js";

// ============================================================
// TOGGLE LIKE POST (Like/Unlike with Cache & Notifications)
// ============================================================
export const toggleLikePost = async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.id;

    // 1. Check if post exists
    const post = await Post.findByPk(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }

    const existingLike = await PostLike.findOne({
      where: { postId, userId }
    });

    const clearCache = async () => {
      if (redisClient?.isReady) {
        await redisClient.del(`post:${postId}`);
      }
    };

    // ===============================
    // 💔 UNLIKE LOGIC
    // ===============================
    if (existingLike) {
      await existingLike.destroy();
      await post.decrement("likesCount");
      await post.reload();
      
      await clearCache();

      return res.json({
        success: true,
        action: "unliked",
        likesCount: post.likesCount
      });
    }

    // ===============================
    // ❤️ LIKE LOGIC
    // ===============================
    await PostLike.create({ postId, userId });
    await post.increment("likesCount");
    await post.reload();

    await clearCache();

    // 🔔 Notification logic (Self-like check)
    // Agar user apni hi post like kare toh notification nahi bhejni
    if (userId !== post.userId) {
      await createNotification({
        senderId: userId,
        receiverId: post.userId,
        type: "LIKE_POST",
        postId
      }).catch(err => console.error("Notification Error:", err));
    }

    return res.json({
      success: true,
      action: "liked",
      likesCount: post.likesCount
    });

  } catch (error) {
    console.error("Toggle like error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to toggle like"
    });
  }
};

// ============================================================
// GET POST LIKES (With User Details)
// ============================================================
export const getPostLikes = async (req, res) => {
  try {
    const postId = req.params.id;

    const likes = await PostLike.findAll({
      where: { postId },
      include: [
        {
          model: User,
          as: "user", // 🔥 Fixed Association check
          attributes: ["id", "username", "name", "profilePhoto", "isVerified"]
        }
      ],
      order: [["createdAt", "DESC"]]
    });

    // Users list map karna
    const users = likes.map(like => like.user).filter(user => user !== null);

    return res.json({
      success: true,
      totalLikes: users.length,
      users
    });

  } catch (error) {
    console.error("Get post likes error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch likes"
    });
  }
};