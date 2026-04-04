import { Post, User, Comment, PostLike } from '../models/index.js';
import { Op } from 'sequelize';



// Get all posts with filters
export const getFeedPosts = async (req, res) => {
  try {
    const userId = req.user.id;

    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const posts = await Post.findAll({
      where: {
        status: "active",
        [Op.or]: [
          { isSaved: true }, // permanent posts
          { expiresAt: { [Op.gt]: new Date() } } // not expired
        ]
      },
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: User,
          as: "author",
          attributes: ["id", "name", "username", "profilePhoto"]
        },
        {
          model: Comment,
          as: "comments",
          limit: 2, // 👈 only preview comments
          order: [["createdAt", "DESC"]],
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "name", "username"]
            }
          ]
        }
      ]
    });

    // 🔥 Add isLiked field
    const formattedPosts = await Promise.all(
      posts.map(async (post) => {
        const isLiked = await PostLike.findOne({
          where: { postId: post.id, userId }
        });

        return {
          id: post.id,
          type: post.type,
          caption: post.caption,
          mediaUrls: post.mediaUrls || [post.mediaUrl],
          createdAt: post.createdAt,

          author: post.author,

          stats: {
            likes: post.likesCount,
            comments: post.commentsCount,
            shares: post.sharesCount
          },

          isLiked: !!isLiked,

          previewComments: post.comments
        };
      })
    );

    return res.json({
      success: true,
      data: formattedPosts
    });

  } catch (error) {
    console.error("Feed error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch feed"
    });
  }
};

export const getPostById = async (req, res) => {
  try {
    const { id } = req.params;
    const post = await Post.findByPk(id, {
      include: [
        { model: User, as: "author", attributes: ["id", "name", "username", "profilePhoto", "status"] },
        {
          model: Comment,
          as: "comments",
          limit: 10,
          order: [["createdAt", "DESC"]],
          include: [{ model: User, as: "user", attributes: ["id", "name", "username"] }]
        }
      ]
    });
    if (!post) return res.status(404).json({ success: false, message: "Post not found" });
    res.json({ success: true, data: post });
  } catch (error) {
    console.error("Get post by ID error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const hidePost = async (req, res) => {
  try {
    const { id } = req.params;
    const post = await Post.findByPk(id);
    if (!post) return res.status(404).json({ success: false, message: "Post not found" });
    post.status = "hidden";
    await post.save();
    res.json({ success: true, message: "Post hidden successfully" });
  } catch (error) {
    console.error("Hide post error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const deletePost = async (req, res) => {
  try {
    const { id } = req.params;
    const post = await Post.findByPk(id);
    if (!post) return res.status(404).json({ success: false, message: "Post not found" });
    post.status = "deleted";
    await post.save();
    res.json({ success: true, message: "Post deleted successfully" });
  } catch (error) {
    console.error("Delete post error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const markSensitive = async (req, res) => {
  try {
    const { id } = req.params;
    const post = await Post.findByPk(id);
    if (!post) return res.status(404).json({ success: false, message: "Post not found" });
    post.status = "sensitive";
    await post.save();
    res.json({ success: true, message: "Post marked as sensitive" });
  } catch (error) {
    console.error("Mark sensitive error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const disableComments = async (req, res) => {
  try {
    const { id } = req.params;
    const { disabled } = req.body;
    const post = await Post.findByPk(id);
    if (!post) return res.status(404).json({ success: false, message: "Post not found" });
    post.commentsEnabled = !disabled;
    await post.save();
    res.json({ success: true, message: disabled ? "Comments disabled" : "Comments enabled" });
  } catch (error) {
    console.error("Disable comments error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
