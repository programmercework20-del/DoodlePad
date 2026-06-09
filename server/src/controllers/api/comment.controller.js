import Comment from "../../models/Comment.js";
import Post from "../../models/Post.js";
import User from "../../models/User.js";
import CommentLike from "../../models/CommentLike.js";
import { createNotification } from "../../services/notification.service.js";
import redisClient from "../../config/redis.js";
import { bucket } from "../../config/firebase.js"; 
import { getIO } from "../../socket/socket.js";
import { injectCommentIsLikedFlag } from "../../utils/commentHelpers.js";

export const addComment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { postId } = req.params;
    // 🔥 FE se metadata variables extract kiye
    const { type, content, parentId, mediaWidth, mediaHeight, audioDuration } = req.body;

    let mediaUrl = null;

    if (req.file) {
      const fileName = `comments/comment_${userId}_${Date.now()}`;
      const blob = bucket.file(fileName);
      await blob.save(req.file.buffer, { 
        metadata: { contentType: req.file.mimetype },
        resumable: false 
      });
      mediaUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    }

    const post = await Post.findByPk(postId);
    if (!post) return res.status(404).json({ success: false, message: "Post not found" });

    const comment = await Comment.create({
      postId,
      userId,
      type: type || "text",
      content,
      mediaUrl,
      parentId: parentId || null,
      mediaWidth: mediaWidth ? parseInt(mediaWidth) : null,
      mediaHeight: mediaHeight ? parseInt(mediaHeight) : null,
      audioDuration: audioDuration ? parseFloat(audioDuration) : null
    });

    await post.increment("commentsCount");

    // 🚀 PRODUCTION REDIS MANAGEMENT
    if (redisClient?.isReady) {
      await redisClient.del(`comments:${postId}`);
      await redisClient.del(`post:${postId}`);
      await redisClient.del(`userPosts:${post.userId}`);
      console.log(`🧹 Cache cleared for postId: ${postId}`);
    }

    // 🔔 NOTIFICATION LOGIC
    let receiverId = post.userId; 
    let notificationType = "COMMENT_POST";

    if (parentId) {
      const parentComment = await Comment.findByPk(parentId);
      if (parentComment) {
        receiverId = parentComment.userId;
        notificationType = "REPLY_COMMENT"; 
      }
    }

    if (receiverId !== userId) {
      createNotification({
        senderId: userId,
        receiverId,
        type: notificationType,
        postId,
        commentId: comment.id
      }).catch(e => console.error("Notification delivery failed:", e));
    }

    // 🔥 FORMAT THE NEW COMMENT FOR FRONTEND & SOCKET
    const formattedNewComment = {
      ...comment.get({ plain: true }),
      isLiked: false, 
      user: {
        id: req.user.id,
        username: req.user.username,
        profilePhoto: req.user.profilePhoto
      },
      replies: [],
      repliesCount: 0 // New comment pe 0 replies
    };

    // 📡 6. REAL-TIME SOCKET BROADCAST
    try {
      const io = getIO();
      if (io) {
        io.to(postId).emit("new_comment", formattedNewComment);
      }
    } catch (socketErr) {
      console.log("⚠️ Socket broadcast failed");
    }

    return res.status(201).json({
      success: true,
      message: parentId ? "Reply added" : "Comment added",
      comment: formattedNewComment 
    });

  } catch (error) {
    console.error("🔥 ADD COMMENT ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to add comment" });
  }
};

export const getPostComments = async (req, res) => {
  try {
    const { postId } = req.params;
    const currentUserId = req.user?.id; 
    const cacheKey = `comments:${postId}`;

    let rawComments = null;

    if (redisClient?.isReady) {
      const cached = await redisClient.get(cacheKey);
      if (cached) rawComments = JSON.parse(cached);
    }

    if (!rawComments) {
      // 1. Sirf main comments nikaalo
      const topLevelComments = await Comment.findAll({
        where: { postId, parentId: null, status: "active" },
        include: [{ model: User, as: "user", attributes: ["id", "username", "profilePhoto"] }],
        order: [["createdAt", "DESC"]]
      });

      // 2. Har comment ke max 2 replies aur total count nikaalo (Pro-level Pagination)
      const commentsWithReplies = await Promise.all(topLevelComments.map(async (c) => {
        const commentJSON = c.get({ plain: true });
        
        const repliesCount = await Comment.count({ where: { parentId: c.id, status: "active" } });
        
        const replies = await Comment.findAll({
          where: { parentId: c.id, status: "active" },
          include: [{ model: User, as: "user", attributes: ["id", "username", "profilePhoto"] }],
          order: [["createdAt", "ASC"]], // Purane replies pehle
          limit: 2
        });

        commentJSON.repliesCount = repliesCount;
        commentJSON.replies = replies.map(r => r.get({ plain: true }));
        return commentJSON;
      }));

      rawComments = commentsWithReplies;
      if (redisClient?.isReady) await redisClient.setEx(cacheKey, 120, JSON.stringify(rawComments));
    }

    const finalizedComments = await injectCommentIsLikedFlag(rawComments, currentUserId);

    return res.json({ success: true, comments: finalizedComments });

  } catch (error) {
    console.error("🔥 GET COMMENTS ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch" });
  }
};

// 🔥 NEW PREMIUM FUNCTION: Baki bache hue replies mangwane ke liye
export const getCommentReplies = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const currentUserId = req.user?.id;
    const offset = (page - 1) * limit;

    const replies = await Comment.findAll({
      where: { parentId: commentId, status: "active" },
      include: [{ model: User, as: "user", attributes: ["id", "username", "profilePhoto"] }],
      order: [["createdAt", "ASC"]],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    const rawReplies = replies.map(r => r.get({ plain: true }));
    const finalizedReplies = await injectCommentIsLikedFlag(rawReplies, currentUserId);

    return res.json({ success: true, replies: finalizedReplies });

  } catch (error) {
    console.error("🔥 GET REPLIES ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch replies" });
  }
};

export const deleteOwnComment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { commentId } = req.params;

    const comment = await Comment.findByPk(commentId);
    if (!comment || comment.userId !== userId) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    if (comment.status === "deleted") return res.status(400).json({ message: "Already deleted" });

    const post = await Post.findByPk(comment.postId);
    await comment.update({ status: "deleted" });

    if (post && post.commentsCount > 0) {
      await post.decrement("commentsCount");
    }

    if (redisClient?.isReady) {
      await redisClient.del(`comments:${comment.postId}`);
      await redisClient.del(`post:${comment.postId}`);
    }

    return res.json({ success: true, message: "Comment deleted" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Delete failed" });
  }
};

export const likeComment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { commentId } = req.params;

    const comment = await Comment.findByPk(commentId, { 
      attributes: ['id', 'userId', 'postId', 'likesCount'] 
    });
    
    if (!comment) return res.status(404).json({ success: false, message: "Comment not found" });

    const existing = await CommentLike.findOne({ where: { commentId, userId } });

    let action;
    let newLikesCount;

    if (existing) {
      await existing.destroy();
      newLikesCount = Math.max(0, comment.likesCount - 1);
      await Comment.update({ likesCount: newLikesCount }, { where: { id: commentId } });
      action = "unliked";
    } else {
      await CommentLike.create({ commentId, userId });
      newLikesCount = comment.likesCount + 1;
      await Comment.update({ likesCount: newLikesCount }, { where: { id: commentId } });
      action = "liked";
    }

    res.json({ success: true, action, likesCount: newLikesCount });

    try {
      const io = getIO();
      if (io) {
        io.to(comment.postId).emit("comment_like_updated", {
          commentId, postId: comment.postId, likesCount: newLikesCount, action, userId
        });
      }
    } catch (socketErr) {
      console.error("⚠️ Socket emit failed:", socketErr.message);
    }

    if (action === "liked" && comment.userId !== userId) {
      createNotification({
        senderId: userId, receiverId: comment.userId, type: "LIKE_COMMENT", postId: comment.postId, commentId
      }).catch(e => console.error("⚠️ Notification Error:", e));
    }

    if (redisClient?.isReady) {
      redisClient.del(`comments:${comment.postId}`)
        .then(() => console.log(`🧹 Cache cleared for comments:${comment.postId}`))
        .catch(e => console.error("Redis clear error:", e));
    }

  } catch (error) {
    console.error("🔥 LIKE COMMENT ERROR:", error);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: "Like failed" });
    }
  }
};