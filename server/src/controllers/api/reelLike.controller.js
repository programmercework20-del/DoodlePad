import ReelLike from "../../models/ReelLike.js";
import Reel from "../../models/Reel.js";

export const toggleReelLike = async (req, res) => {
  try {
    const userId = req.user.id;
    const { reelId } = req.params;

    const existing = await ReelLike.findOne({ where: { userId, reelId } });

    // 👉 If already liked → UNLIKE
    if (existing) {
      await existing.destroy();

      await Reel.decrement("likesCount", { where: { id: reelId } });

      return res.json({
        success: true,
        message: "Reel unliked",
        liked: false,
      });
    }

    // 👉 If not liked → LIKE
    await ReelLike.create({ userId, reelId });
    await Reel.increment("likesCount", { where: { id: reelId } });

    res.json({
      success: true,
      message: "Reel liked",
      liked: true,
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
