import Reel from "../../models/Reel.js";
import ReelShare from "../../models/ReelShare.js";

export const shareReel = async (req, res) => {
  try {
    const userId = req.user.id;
    const reelId = req.params.id;
    const { type, targetUserId } = req.body;

    // ✅ validation
    if (!type) {
      return res.status(400).json({
        success:false,
        message:"Share type is required (dm / story / external)"
      });
    }

    const reel = await Reel.findByPk(reelId);
    if (!reel) {
      return res.status(404).json({ message:"Reel not found" });
    }

    // create share entry
    await ReelShare.create({
      reelId,
      userId,
      type,
      targetUserId: targetUserId || null
    });

    // increase reel share count
    await reel.increment("sharesCount");

    res.json({
      success:true,
      message:"Reel shared successfully"
    });

  } catch (error) {
    console.error("Reel share error:", error);
    res.status(500).json({
      success:false,
      message:"Failed to share reel"
    });
  }
};
  