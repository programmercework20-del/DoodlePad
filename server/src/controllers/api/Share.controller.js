import Share from "../../models/Share.js";
import Post from "../../models/Post.js";

export const sharePost = async (req, res) => {
  try {
    const userId = req.user.id;
    const { targetUserId, type } = req.body;
    const postId = req.params.id;

    const post = await Post.findByPk(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    await Share.create({
      postId,
      userId,
      targetUserId: targetUserId || null,
      type: type || "external"
    });

    await post.increment("sharesCount");

    res.json({
      success: true,
      message: "Post shared"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Share failed" });
  }
};
