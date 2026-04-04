import Post from "../../models/Post.js";
import PostLike from "../../models/PostLike.js";

export const toggleLikePost = async (req, res) => {
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

    const existingLike = await PostLike.findOne({
      where: { postId, userId }
    });

    // 💔 UNLIKE
    if (existingLike) {
      await existingLike.destroy();
      await post.decrement("likesCount");

      await post.reload(); // ✅ IMPORTANT FIX

      return res.json({
        success: true,
        action: "unliked",
        likesCount: post.likesCount
      });
    }

    // ❤️ LIKE
    await PostLike.create({ postId, userId });
    await post.increment("likesCount");

    await post.reload(); // ✅ IMPORTANT FIX

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
};``