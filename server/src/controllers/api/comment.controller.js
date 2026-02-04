import Comment from "../../models/Comment.js";
import Post from "../../models/Post.js";
import User from "../../models/User.js";
import CommentLike from "../../models/CommentLike.js";



// Add a comment to a post
export const addComment = async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.postId;
    const { type, content } = req.body;

    let mediaUrl = null;
    if (req.file) {
      mediaUrl = `/uploads/${req.file.filename}`;
    }

    // 1. Post check
    const post = await Post.findByPk(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    if (!post.commentsEnabled) {
      return res.status(403).json({ success: false, message: "Comments disabled on this post" });
    }

    // 2. Validation
    const allowedTypes = ["text", "emoji", "image", "audio", "video", "doodle", "gif"];
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ success: false, message: "Invalid comment type" });
    }

    if (["image", "audio", "video", "doodle", "gif"].includes(type) && !mediaUrl) {
      return res.status(400).json({
        success: false,
        message: "File is required for this comment type"
      });
    }

    if ((type === "text" || type === "emoji") && !content) {
      return res.status(400).json({
        success: false,
        message: "content is required for text/emoji comment"
      });
    }

    // 3. Create
    const comment = await Comment.create({
      postId,
      userId,
      type,
      content,
      mediaUrl
    });

    await post.increment("commentsCount");

    return res.status(201).json({
      success: true,
      message: "Comment added successfully",
      comment
    });

  } catch (error) {
    console.error("Add comment error:", error);
    res.status(500).json({ success: false, message: "Failed to add comment" });
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

    const post = await Post.findByPk(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }

    const comments = await Comment.findAll({
      where: {
        postId,
        status: "active"
      },
      attributes: [
        "id",
        "content",
        "mediaUrl",
        "type",
        "likesCount",
        "createdAt"
      ],
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "username", "name", "profilePhoto"]
        }
      ],
      order: [["createdAt", "DESC"]]
    });

    return res.json({
      success: true,
      comments
    });

  } catch (error) {
    console.error("GET COMMENTS ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get comments"
    });
  }
};


// Delete a comment

export const deleteComment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { commentId } = req.params;

    // 1️⃣ Comment find karo
    const comment = await Comment.findByPk(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found"
      });
    }

    // 2️⃣ Owner check
    if (comment.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to delete this comment"
      });
    }

    // 3️⃣ Post find karo
    const post = await Post.findByPk(comment.postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }

    // 4️⃣ Soft delete
    comment.status = "deleted";
    await comment.save();

    // 5️⃣ Counter update
    await post.decrement("commentsCount");

    return res.status(200).json({
      success: true,
      message: "Comment deleted successfully"
    });

  } catch (error) {
    console.error("Delete comment error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete comment"
    });
  }
};

// export const likeComment = async (req, res) => {
//   try {
//     const userId = req.user.id;
//     const { commentId } = req.params;

//     // 1️⃣ Comment exists?
//     const comment = await Comment.findByPk(commentId);
//     if (!comment) {
//       return res.status(404).json({
//         success: false,
//         message: "Comment not found"
//       });
//     }

//     // 2️⃣ Already liked?
//     const existingLike = await CommentLike.findOne({
//       where: { commentId, userId }
//     });

//     if (existingLike) {
//       // Unlike
//       await existingLike.destroy();
//       return res.json({
//         success: true,
//         message: "Comment unliked"
//       });
//     }

//     // 3️⃣ Like
//     await CommentLike.create({ commentId, userId });

//     return res.json({
//       success: true,
//       message: "Comment liked"
//     });

//   } catch (error) {
//     console.error("Like comment error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to like comment"
//     });
//   }
// };


export const likeComment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { commentId } = req.params;

    const comment = await Comment.findByPk(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, message: "Comment not found" });
    }

    const existingLike = await CommentLike.findOne({
      where: { commentId, userId }
    });

    if (existingLike) {
      // Unlike
      await existingLike.destroy();
      await comment.decrement("likesCount");   // 👈 counter --
      return res.json({ success: true, message: "Comment unliked" });
    } else {
      // Like
      await CommentLike.create({ commentId, userId });
      await comment.increment("likesCount");   // 👈 counter ++
      return res.json({ success: true, message: "Comment liked" });
    }

  } catch (error) {
    console.error("Like comment error:", error);
    res.status(500).json({ success: false, message: "Failed to like comment" });
  }
};
