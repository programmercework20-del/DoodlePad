import Comment from "../../models/Comment.js";
import Post from "../../models/Post.js";
import User from "../../models/User.js";
import CommentLike from "../../models/CommentLike.js";
import { createNotification } from "../../services/notification.service.js";



// Add a comment to a post
export const addComment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { postId } = req.params;
    const { type, content, parentId } = req.body;

    const baseUrl = `${req.protocol}://${req.get("host")}`;

    let mediaUrl = null;
    if (req.file) {
      mediaUrl = `${baseUrl}/uploads/${req.file.filename}`;
    }

    const post = await Post.findByPk(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const comment = await Comment.create({
      postId,
      userId,
      type,
      content,
      mediaUrl,
      parentId: parentId || null
    });

    await post.increment("commentsCount");

    // 🔥 DETERMINE RECEIVER
    let receiverId = post.userId;

    if (parentId) {
      const parentComment = await Comment.findByPk(parentId);

      if (parentComment && parentComment.userId !== userId) {
        receiverId = parentComment.userId;
      }
    }

    // ✅ PREVENT SELF NOTIFICATION
    if (receiverId !== userId) {
      await createNotification({
        senderId: userId,
        receiverId,
        type: parentId ? "REPLY_COMMENT" : "COMMENT_POST",
        postId,
        commentId: comment.id
      });
    }

    res.status(201).json({
      success: true,
      message: parentId ? "Reply added" : "Comment added",
      comment
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to add comment" });
  }
};
// get comments by postId.
// export const getPostComments = async (req, res) => {
//   try {
//     const { postId } = req.params;

//     const post = await Post.findByPk(postId);
//     if (!post) {
//       return res.status(404).json({
//         success: false,
//         message: "Post not found"
//       });
//     }

//     const comments = await Comment.findAll({
//       where: { postId, status: "active" },
//       include: [
//         {
//           model: User,
//           as: "user",
//           attributes: ["id", "username", "name", "profilePhoto"]
//         }
//       ],
//       order: [["createdAt", "DESC"]]
//     });

//     return res.json({
//       success: true,
//       comments
//     });

//   } catch (error) {
//     console.error("GET COMMENTS ERROR:", error); // 👈 ye important
//     res.status(500).json({
//       success: false,
//       message: "Failed to get comments"
//     });
//   }
// };

export const getPostComments = async (req, res) => {
  try {
    const { postId } = req.params;

    const comments = await Comment.findAll({
      where: {
        postId,
        parentId: null, // 🔥 only top-level
        status: "active"
      },
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

    res.json({
      success: true,
      comments
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch comments" });
  }
};


// Delete a comment

export const deleteOwnComment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { commentId } = req.params;

    const comment = await Comment.findByPk(commentId);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found"
      });
    }

    // ✅ Only owner can delete
    if (comment.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own comment"
      });
    }

    // ✅ Prevent double delete
    if (comment.status === "deleted") {
      return res.status(400).json({
        success: false,
        message: "Comment already deleted"
      });
    }

    const post = await Post.findByPk(comment.postId);

    // ✅ Soft delete
    await comment.update({ status: "deleted" });

    // ✅ Safe decrement
    if (post && post.commentsCount > 0) {
      await post.decrement("commentsCount");
    }

    return res.json({
      success: true,
      message: "Comment deleted successfully"
    });

  } catch (error) {
    console.error("USER DELETE COMMENT ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete comment"
    });
  }
};

export const likeComment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { commentId } = req.params;

    const comment = await Comment.findByPk(commentId);
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    const existing = await CommentLike.findOne({
      where: { commentId, userId }
    });

    // UNLIKE
    if (existing) {
      await existing.destroy();
      await comment.decrement("likesCount");
      await comment.reload();

      return res.json({
        success: true,
        action: "unliked",
        likesCount: comment.likesCount
      });
    }

    // LIKE
    await CommentLike.create({ commentId, userId });
    await comment.increment("likesCount");
    await comment.reload();

    // ✅ ONLY ONCE
    if (comment.userId !== userId) {
      await createNotification({
        senderId: userId,
        receiverId: comment.userId,
        type: "LIKE_COMMENT",
        postId: comment.postId,
        commentId
      });
    }

    return res.json({
      success: true,
      action: "liked",
      likesCount: comment.likesCount
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Like failed" });
  }
};
