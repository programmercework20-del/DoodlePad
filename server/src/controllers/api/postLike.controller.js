import Post from "../../models/Post.js";
import PostLike from "../../models/PostLike.js";
import { createNotification } from "../../services/notification.service.js";
import User from "../../models/User.js";
import redisClient from "../../config/redis.js";
import sequelize from "../../config/db.js";
import { Op } from "sequelize";

// ============================================================
// TOGGLE LIKE POST — Race Condition Safe + No Negative Count
// ============================================================
export const toggleLikePost = async (req, res) => {
  const userId = req.user.id;
  const postId = req.params.id;

  // 🔥 FIX 1: Transaction use karo — race condition prevent
  const transaction = await sequelize.transaction();

  try {
    // Post check karo — transaction ke andar
    const post = await Post.findByPk(postId, { 
      transaction,
      lock: transaction.LOCK.UPDATE // 🔥 Row lock — concurrent requests block
    });

    if (!post) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    // 🔥 FIX 2: Like check transaction ke andar
    const existingLike = await PostLike.findOne({
      where: { postId, userId },
      transaction
    });

    let action;
    let newLikesCount;

    if (existingLike) {
      // ===============================
      // 💔 UNLIKE LOGIC
      // ===============================
      await existingLike.destroy({ transaction });

      // 🔥 FIX 3: likesCount kabhi 0 se kam nahi jayega
      await Post.update(
        { likesCount: sequelize.literal(`GREATEST("likesCount" - 1, 0)`) },
        { where: { id: postId }, transaction }
      );

      action = "unliked";

    } else {
      // ===============================
      // ❤️ LIKE LOGIC
      // ===============================

      // 🔥 FIX 4: Duplicate like prevent — findOrCreate use karo
      const [like, created] = await PostLike.findOrCreate({
        where: { postId, userId },
        defaults: { postId, userId },
        transaction
      });

      if (!created) {
        // Already liked — duplicate request tha
        await transaction.rollback();
        const currentPost = await Post.findByPk(postId);
        return res.json({
          success: true,
          action: "already_liked",
          likesCount: currentPost.likesCount
        });
      }

      await Post.update(
        { likesCount: sequelize.literal(`"likesCount" + 1`) },
        { where: { id: postId }, transaction }
      );

      action = "liked";
    }

    // Transaction commit
    await transaction.commit();

    // Fresh count DB se lo
    const updatedPost = await Post.findByPk(postId, {
      attributes: ["likesCount"]
    });
    newLikesCount = updatedPost.likesCount;

    // Cache clear
    if (redisClient?.isReady) {
      await redisClient.del(`post:${postId}`).catch(() => {});
    }

    // Notification — sirf like pe, unlike pe nahi
    if (action === "liked" && userId !== post.userId) {
      createNotification({
        senderId: userId,
        receiverId: post.userId,
        type: "LIKE_POST",
        postId
      }).catch(err => console.error("Notification Error:", err));
    }

    return res.json({
      success: true,
      action,
      likesCount: newLikesCount
    });

  } catch (error) {
    await transaction.rollback();
    console.error("Toggle like error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to toggle like"
    });
  }
};

// ============================================================
// GET POST LIKES
// ============================================================
export const getPostLikes = async (req, res) => {
  try {
    const postId = req.params.id;

    const likes = await PostLike.findAll({
      where: { postId },
      include: [{
        model: User,
        as: "user",
        attributes: ["id", "username", "name", "profilePhoto", "isVerified"]
      }],
      order: [["createdAt", "DESC"]]
    });

    const users = likes.map(like => like.user).filter(Boolean);

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