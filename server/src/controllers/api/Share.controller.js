import Post from "../../models/Post.js";
import Share from "../../models/Share.js";

export const sharePost = async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.id;
    const { type, targetUserId } = req.body;

    // 🛑 Validation FIRST
    if (!type) {
      return res.status(400).json({
        success: false,
        message: "Share type is required (dm / story / external)"
      });
    }

    const post = await Post.findByPk(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    await Share.create({
      postId,
      userId,
      type,
      targetUserId: targetUserId || null
    });

    await post.increment("sharesCount");

    res.json({
      success: true,
      message: "Post shared successfully"
    });

  } catch (error) {
    console.error("Share error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to share post"
    });
  }
};
