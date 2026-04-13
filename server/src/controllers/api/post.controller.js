import Post from "../../models/Post.js";
import User from "../../models/User.js";
import Comment from "../../models/Comment.js";
import { processHashtags } from "../../utils/hashtag.util.js";
import { Op } from "sequelize";


export const createPost = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, caption, content, isSaved } = req.body;

    const cleanType = type?.trim().toLowerCase();

    const isSavedBool = isSaved === "true" || isSaved === true;

    const baseUrl = `${req.protocol}://${req.get("host")}`;

    let mediaUrls = [];

    if (req.files && req.files.length > 0) {
      mediaUrls = req.files.map(
        file => `${baseUrl}/uploads/stories/${file.filename}`
      );
    }

    const allowedTypes = ["image", "video", "audio", "doodle", "text"];

    if (!allowedTypes.includes(cleanType)) {
      return res.status(400).json({ message: "Invalid post type" });
    }

    if (
      ["image", "video", "audio"].includes(cleanType) &&
      mediaUrls.length === 0
    ) {
      return res.status(400).json({ message: "File is required" });
    }

    if (cleanType === "doodle" && !content) {
      return res.status(400).json({ message: "Doodle data required" });
    }

    if (cleanType === "text" && !content) {
      return res.status(400).json({ message: "Content required" });
    }

    let expiresAt = null;

    if (!isSavedBool) {
      expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }

    const post = await Post.create({
      userId,
      type: cleanType,
      content,
      caption,
      mediaUrls,
      isSaved: isSavedBool,
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

export const getArchivedPosts = async (req, res) => {
  try {
    const userId = req.user.id;

    // 🔥 IMPORTANT FIX
    await markExpiredPosts();

    const posts = await Post.findAll({
      where: {
        userId,
        status: "archived"
      },
      order: [["createdAt", "DESC"]]
    });

    return res.json({
      success: true,
      count: posts.length,
      posts
    });

  } catch (error) {
    console.error("ARCHIVE FETCH ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch archived posts"
    });
  }
};

export const markExpiredPosts = async () => {
  try {
    await Post.update(
      { status: "archived" },
      {
        where: {
          isSaved: false,
          expiresAt: {
            [Op.lt]: new Date()
          },
          status: "active"
        }
      }
    );
  } catch (error) {
    console.error("Expire job error:", error);
  }
};

export const getExpiredPosts = async (req, res) => {
  try {
    const userId = req.user.id;

    const posts = await Post.findAll({
      where: {
        userId,
        isSaved: false,
        expiresAt: {
            [Op.lt]: new Date()
          }
      },
      order: [["createdAt", "DESC"]]
    });

    return res.json({
      success: true,
      count: posts.length,
      posts
    });

  } catch (error) {
    console.error("EXPIRED FETCH ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch expired posts"
    });
  }
};

export const restoreArchivedPost = async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.id;

    const post = await Post.findByPk(postId);

    if (!post || post.userId !== userId) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }

    if (post.status !== "archived") {
      return res.status(400).json({
        success: false,
        message: "Post is not archived"
      });
    }

    await post.update({
      status: "active",
      isSaved: true,   // 🔥 now permanent
      expiresAt: null
    });

    return res.json({
      success: true,
      message: "Post restored and made permanent"
    });

  } catch (error) {
    console.error("RESTORE ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Restore failed"
    });
  }
};

export const archivePost = async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.id;

    const post = await Post.findByPk(postId);

    if (!post || post.userId !== userId) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }

    if (post.status === "archived") {
      return res.status(400).json({
        success: false,
        message: "Post already archived"
      });
    }

    await post.update({
      status: "archived",
      expiresAt: null // 🔥 IMPORTANT (stop expiry)
    });

    return res.json({
      success: true,
      message: "Post moved to archive"
    });

  } catch (error) {
    console.error("ARCHIVE ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Archive failed"
    });
  }
};

export const deletePost = async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.id;

    const post = await Post.findByPk(postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }

    // ✅ Ownership check
    if (post.userId !== userId && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to delete this post"
      });
    }

    // ✅ Already deleted check
    if (post.status === "deleted") {
      return res.status(400).json({
        success: false,
        message: "Post already deleted"
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
};

export const getUserPosts = async (req, res) => {
  try {
    const { id } = req.params;

    const posts = await Post.findAll({
      where: {
        userId: id,
        status: "active",
        [Op.or]: [
          { isSaved: true },
          {
            isSaved: false,
            expiresAt: { [Op.gt]: new Date() } // ✅ NOT expired
          }
        ]
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
