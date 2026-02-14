import Reel from "../../models/Reel.js";
import ReelView from "../../models/ReelView.js";

export const trackReelView = async (req, res) => {
  try {
    const userId = req.user.id;
    const { reelId } = req.params;
    const { watchTime } = req.body;

    const reel = await Reel.findByPk(reelId);
    if (!reel) return res.status(404).json({ message:"Reel not found" });

    let view = await ReelView.findOne({
      where: { reelId, userId }
    });

    if (!view) {
      view = await ReelView.create({
        reelId,
        userId,
        watchTime,
        completed: watchTime >= reel.duration
      });

      await reel.increment("viewsCount");

      return res.json({ message:"View tracked" });
    }

    view.watchTime += watchTime;
    view.rewatchCount += 1;
    view.completed = view.completed || watchTime >= reel.duration;
    view.lastWatchedAt = new Date();

    await view.save();

    res.json({ message:"Rewatch tracked" });

  } catch (err) {
    console.error("Track view error:", err);
    res.status(500).json({ message:"Failed to track view" });
  }
};
