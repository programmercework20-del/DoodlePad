import Reel from "../../models/Reel.js";
import ReelComment from "../../models/ReelComment.js";
import ReelCommentLike from "../../models/ReelCommentLike.js";
import User from "../../models/User.js";


// =============================
// ADD COMMENT ON REEL
// =============================
export const addReelComment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { reelId } = req.params;
    const { content } = req.body;                                              

    if (!content)
      return res.status(400).json({ success: false, message: "Comment is required" });

    const reel = await Reel.findByPk(reelId);
    if (!reel)
      return res.status(404).json({ success: false, message: "Reel not found" });

    const comment = await ReelComment.create({
      reelId,
      userId,
      content
    });

    await reel.increment("commentsCount");

    res.status(201).json({
      success: true,
      message: "Reel comment added",
      comment
    });
  } catch (err) {
    console.error("Add reel comment error:", err);
    res.status(500).json({ success: false, message: "Failed to add comment" });
  }
};


// =============================
// GET REEL COMMENTS
// =============================
export const getReelComments = async (req, res) => {
  try {
    const { reelId } = req.params;

    const comments = await ReelComment.findAll({
      where: { reelId },

      include: [
        {
          model: User,
          as: "user",   // ⭐⭐⭐ THIS WAS MISSING
          attributes: ["id", "username", "name", "profilePhoto"]
        }
      ],

      order: [["createdAt", "DESC"]]
    });

    res.json({ success: true, comments });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Failed to get comments"
    });
  }
};



// =============================
// DELETE REEL COMMENT
// =============================
export const deleteReelComment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { commentId } = req.params;

    const comment = await ReelComment.findByPk(commentId);
    if (!comment)
      return res.status(404).json({ success:false, message:"Comment not found" });

    if (comment.userId !== userId)
      return res.status(403).json({ success:false, message:"Not allowed" });

    await comment.destroy();

    const reel = await Reel.findByPk(comment.reelId);
    await reel.decrement("commentsCount");

    res.json({ success:true, message:"Comment deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success:false, message:"Delete failed" });
  }
};


// =============================
// LIKE / UNLIKE REEL COMMENT
// =============================
export const likeReelComment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { commentId } = req.params;

    const comment = await ReelComment.findByPk(commentId);
    if (!comment)
      return res.status(404).json({ success:false, message:"Comment not found" });

    const existing = await ReelCommentLike.findOne({
      where: { commentId, userId }
    });

    if (existing) {
      await existing.destroy();
      await comment.decrement("likesCount");
      return res.json({ success:true, message:"Comment unliked" });
    }

    await ReelCommentLike.create({ commentId, userId });
    await comment.increment("likesCount");

    res.json({ success:true, message:"Comment liked" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success:false, message:"Like failed" });
  }
};
