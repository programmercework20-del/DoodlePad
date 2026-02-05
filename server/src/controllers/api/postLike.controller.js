import Post from "../../models/Post.js";
import PostLike from "../../models/PostLike.js";

export const toggleLikePost = async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.id;

    // 1️⃣ Check post exists
    const post = await Post.findByPk(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }

    // 2️⃣ Check existing like
    const existingLike = await PostLike.findOne({
      where: { postId, userId }
    });

    // 💔 UNLIKE (if already liked)
    if (existingLike) {
      await existingLike.destroy();
      await post.decrement("likesCount");

      return res.json({
        success: true,
        action: "unliked",
        message: "Post unliked"
      });
    }

    // ❤️ LIKE (if not liked)
    await PostLike.create({ postId, userId });
    await post.increment("likesCount");

    return res.json({
      success: true,
      action: "liked",
      message: "Post liked"
    });

  } catch (error) {
    console.error("Toggle like error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to toggle like"
    });
  }
};
