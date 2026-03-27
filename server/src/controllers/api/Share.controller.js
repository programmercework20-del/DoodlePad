import Share from "../../models/Share.js";

export const sharePost = async (req, res) => {
  try {
    const userId = req.user.id;
    const { targetUserId } = req.body;
    const postId = req.params.id;

    await Share.create({
      postId,
      userId,
      targetUserId,
      type: "dm"
    });

    // increment counter
    await Post.increment("sharesCount", { where: { id: postId } });

    res.json({
      success: true,
      message: "Post shared"
    });

  } catch (error) {
    console.error("Share error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to share post"
    });
  }
};
