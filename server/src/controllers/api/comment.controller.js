import Comment from "../../models/Comment.js";
import Post from "../../models/Post.js";
import User from "../../models/User.js";
import CommentLike from "../../models/CommentLike.js";
import { createNotification } from "../../services/notification.service.js";
import redisClient from "../../config/redis.js";
import { bucket } from "../../config/firebase.js"; // 🔥 GCS Bucket
import { getIO } from "../../socket/socket.js";
// ============================================================
// ADD COMMENT / REPLY (With GCS & Cache Clear)
// ============================================================
// export const addComment = async (req, res) => {
//   try {
//     const userId = req.user.id;
//     const { postId } = req.params;
//     const { type, content, parentId } = req.body;

//     let mediaUrl = null;

//     // 🔥 GCS Bucket Upload logic
//     if (req.file) {
//       const fileName = `comments/comment_${userId}_${Date.now()}`;
//       const blob = bucket.file(fileName);
//       await blob.save(req.file.buffer, { metadata: { contentType: req.file.mimetype } });
//       mediaUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
//     }

//     const post = await Post.findByPk(postId);
//     if (!post) return res.status(404).json({ success: false, message: "Post not found" });

//     const comment = await Comment.create({
//       postId,
//       userId,
//       type: type || "text",
//       content,
//       mediaUrl,
//       parentId: parentId || null
//     });

//     await post.increment("commentsCount");

//     // 🚀 Clear Redis Cache for this post's comments
//     if (redisClient?.isReady) {
//       await redisClient.del(`comments:${postId}`);
//       await redisClient.del(`post:${postId}`);
//     }

//     // 🔔 Notification Logic
//     let receiverId = post.userId;
//     if (parentId) {
//       const parentComment = await Comment.findByPk(parentId);
//       if (parentComment && parentComment.userId !== userId) {
//         receiverId = parentComment.userId;
//       }
//     }

//     if (receiverId !== userId) {
//       createNotification({
//         senderId: userId,
//         receiverId,
//         type: parentId ? "REPLY_COMMENT" : "COMMENT_POST",
//         postId,
//         commentId: comment.id
//       }).catch(e => console.error(e));
//     }

//     return res.status(201).json({
//       success: true,
//       message: parentId ? "Reply added" : "Comment added",
//       comment
//     });

//   } catch (error) {
//     console.error("ADD COMMENT ERROR:", error);
//     return res.status(500).json({ success: false, message: "Failed to add comment" });
//   }
// };
// comment.controller.js
export const addComment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { postId } = req.params;
    const { type, content, parentId } = req.body;

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
      parentId: parentId || null
    });

    await post.increment("commentsCount");

    // 🚀 PRODUCTION REDIS MANAGEMENT
    if (redisClient?.isReady) {
      // 1. Is post ki puri comment list delete karein
      await redisClient.del(`comments:${postId}`);
      
      // 2. Individual post detail cache delete karein
      await redisClient.del(`post:${postId}`);

      // 3. User profile cache delete karein (Post count update ke liye)
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
        notificationType = "REPLY_COMMENT"; // ✅ Triggering Reply Notification
      }
    }

    if (receiverId !== userId) {
      // Notification send (Background task)
      createNotification({
        senderId: userId,
        receiverId,
        type: notificationType,
        postId,
        commentId: comment.id
      }).catch(e => console.error("Notification delivery failed:", e));
    }

    return res.status(201).json({
      success: true,
      message: parentId ? "Reply added" : "Comment added",
      comment
    });

  } catch (error) {
    console.error("🔥 ADD COMMENT ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to add comment" });
  }
};
// ============================================================
// GET POST COMMENTS (Top-level + Replies)
// ============================================================
export const getPostComments = async (req, res) => {
  try {
    const { postId } = req.params;
    const cacheKey = `comments:${postId}`;

    // 🚀 Redis Check
    if (redisClient?.isReady) {
      const cached = await redisClient.get(cacheKey);
      if (cached) return res.json({ success: true, comments: JSON.parse(cached) });
    }

    const comments = await Comment.findAll({
      where: { postId, parentId: null, status: "active" },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "username", "profilePhoto"]
        },
        {
          model: Comment,
          as: "replies",
          where: { status: "active" },
          required: false,
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "username", "profilePhoto"]
            }
          ]
        }
      ],
      order: [["createdAt", "DESC"]]
    });

    if (redisClient?.isReady) {
      await redisClient.setEx(cacheKey, 300, JSON.stringify(comments));
    }

    return res.json({ success: true, comments });

  } catch (error) {
    console.error("GET COMMENTS ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch comments" });
  }
};

// ============================================================
// DELETE OWN COMMENT (Soft Delete)
// ============================================================
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

    // 🚀 Clear Cache
    if (redisClient?.isReady) {
      await redisClient.del(`comments:${comment.postId}`);
      await redisClient.del(`post:${comment.postId}`);
    }

    return res.json({ success: true, message: "Comment deleted" });

  } catch (error) {
    return res.status(500).json({ success: false, message: "Delete failed" });
  }
};

// ============================================================
// LIKE COMMENT (Toggle)
// ============================================================
// export const likeComment = async (req, res) => {
//   try {
//     const userId = req.user.id;
//     const { commentId } = req.params;

//     const comment = await Comment.findByPk(commentId);
//     if (!comment) return res.status(404).json({ message: "Comment not found" });

//     const existing = await CommentLike.findOne({ where: { commentId, userId } });

//     if (existing) {
//       await existing.destroy();
//       await comment.decrement("likesCount");
//       await comment.reload();
//       return res.json({ success: true, action: "unliked", likesCount: comment.likesCount });
//     }

//     await CommentLike.create({ commentId, userId });
//     await comment.increment("likesCount");
//     await comment.reload();

//     if (comment.userId !== userId) {
//       createNotification({
//         senderId: userId,
//         receiverId: comment.userId,
//         type: "LIKE_COMMENT",
//         postId: comment.postId,
//         commentId
//       }).catch(e => console.error(e));
//     }

//     return res.json({ success: true, action: "liked", likesCount: comment.likesCount });

//   } catch (error) {
//     return res.status(500).json({ success: false, message: "Like failed" });
//   }
// };

export const likeComment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { commentId } = req.params;

    const comment = await Comment.findByPk(commentId, { 
      attributes: ['id', 'userId', 'postId', 'likesCount'] 
    });
    
    if (!comment) return res.status(404).json({ 
      success: false, 
      message: "Comment not found" 
    });

    const existing = await CommentLike.findOne({ 
      where: { commentId, userId } 
    });

    let action;
    let newLikesCount;

    if (existing) {
      // 🔥 FIX: DB aur in-memory ek saath update
      await existing.destroy();
      newLikesCount = Math.max(0, comment.likesCount - 1);
      await Comment.update(
        { likesCount: newLikesCount },
        { where: { id: commentId } }
      );
      action = "unliked";
    } else {
      await CommentLike.create({ commentId, userId });
      newLikesCount = comment.likesCount + 1;
      await Comment.update(
        { likesCount: newLikesCount },
        { where: { id: commentId } }
      );
      action = "liked";
    }

    // ⚡ INSTANT RESPONSE — reload() nahi, delay nahi
    res.json({ success: true, action, likesCount: newLikesCount });

    // ============================================================
    // ⚙️ BACKGROUND TASKS — response ke baad
    // ============================================================

    // 📡 Socket — saare users ko instant update
    try {
      const io = getIO();
      if (io) {
        // 🔥 Post room mein saare users ko emit karo
        io.to(comment.postId).emit("comment_like_updated", {
          commentId,
          postId: comment.postId,
          likesCount: newLikesCount,
          action,
          userId
        });
      }
    } catch (socketErr) {
      console.error("⚠️ Socket emit failed:", socketErr.message);
    }

    // 🔔 Notification
    if (action === "liked" && comment.userId !== userId) {
      createNotification({
        senderId: userId,
        receiverId: comment.userId,
        type: "LIKE_COMMENT",
        postId: comment.postId,
        commentId
      }).catch(e => console.error("⚠️ Notification Error:", e));
    }

    // 🧠 Redis cache clear
    if (redisClient?.isReady) {
      redisClient.del(`post_comments:${comment.postId}`)
        .catch(e => console.error(e));
    }

  } catch (error) {
    console.error("🔥 LIKE COMMENT ERROR:", error);
    if (!res.headersSent) {
      return res.status(500).json({ 
        success: false, 
        message: "Like failed" 
      });
    }
  }
};