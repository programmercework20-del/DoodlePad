import Post from "../../models/Post.js";
import User from "../../models/User.js";
import Comment from "../../models/Comment.js";
import { processHashtags } from "../../utils/hashtag.util.js";


export const createPost = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, caption, content, isSaved } = req.body;

    const cleanType = type?.trim().toLowerCase();

    let mediaUrls = [];

    if (req.files && req.files.length > 0) {
      mediaUrls = req.files.map(file => `/uploads/stories/${file.filename}`);
    }

    const allowedTypes = ["image", "video", "audio", "doodle", "text", "live"];

    if (!allowedTypes.includes(cleanType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post type"
      });
    }

    if (["image", "video", "audio", "doodle"].includes(cleanType) && mediaUrls.length === 0) {
      return res.status(400).json({
        success: false,
        message: "File is required"
      });
    }

    if (cleanType === "text" && !content) {
      return res.status(400).json({
        success: false,
        message: "Content required"
      });
    }

    let expiresAt = null;

    if (!isSaved) {
      expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }

    const post = await Post.create({
      userId,
      type: cleanType,
      content,
      caption,
      mediaUrls,
      isSaved: isSaved || false,
      expiresAt
    });

    return res.status(201).json({
      success: true,
      message: "Post created",
      post
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to create post"
    });
  }
};

export const deletePost = async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.id;

    // 1. Find Post
    const post = await Post.findByPk(postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }

    // 2.check ownership

    if (post.userId !== userId) {
      return res.json(403).json({
        success: false,
        message: "you are not allowed to delete this post"
      });
    }

    // 2. Already deleted?

    if (post.userId === "deleted") {
      return res.json(400).json({
        success: false,
        message: "post already deleted"
      });
    }

    await post.update({ status: "deleted" });

    return res.json({
      success: true,
      message: "Post deleted successfully"
    });

  } catch (error) {
    console.error("Delete post error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete post"
    });
  }
}

export const getUserPosts = async (req, res) => {
  try {
    const { id } = req.params;

    const posts = await Post.findAll({
      where: {
        userId: id,
        status: "active"
      },
      include: [
        {
          model: User,
          as: "author",
          attributes: ["id", "username", "profilePhoto"]
        },
        {
          model: Comment,
          as: "comments",
          attributes: ["id", "content", "createdAt"]
        }
      ],
      order: [["createdAt", "DESC"]]
    });

    return res.json({
      success: true,
      count: posts.length,
      posts
    });

  } catch (error) {
    console.error("Get user posts error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user posts"
    });
  }
};
