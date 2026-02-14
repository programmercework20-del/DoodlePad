import StoryView from "../../models/StoryView.js";


export const markStorySeen = async (req, res) => {
  try {
    // 1️⃣ hard validation (THIS was missing)
    const { storyId } = req.body;

    if (!storyId) {
      return res.status(400).json({
        success: false,
        message: "storyId is required"
      });
    }

    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    const viewerId = req.user.id;

    // 2️⃣ prevent duplicate seen rows (important)
    const [view, created] = await StoryView.findOrCreate({
      where: { storyId, viewerId },
      defaults: { storyId, viewerId }
    });

    return res.status(200).json({
      success: true,
      message: created ? "Story marked as seen" : "Story already seen"
    });

  } catch (err) {
    console.error("MARK STORY SEEN ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to mark seen"
    });
  }
};





export const getStoryViews = async (req, res) => {
  try {
    const { storyId } = req.params;

    const views = await StoryView.findAll({
      where: { storyId }
    });

    res.status(200).json({
      success: true,
      count: views.length,
      data: views
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};