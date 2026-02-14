import StoryReaction from "../../models/StoryReaction.js";


// POST /stories/:id/react
export const reactToStory = async (req, res) => {
    console.log("Reacting to story with data:", {
        storyId: req.params.id,
        userId: req.user.id,
        ...req.body
    });
  try {
    const { id: storyId } = req.params;
    const { type, content } = req.body;
    const userId = req.user.id;

    if (!type) {
      return res.status(400).json({
        success: false,
        message: "Reaction type is required"
      });
    }

    const reaction = await StoryReaction.create({
      storyId,
      userId,
      type,
      content
    });

    res.status(201).json({
      success: true,
      message: "Reaction added",
      data: reaction
    });

  } catch (err) {
    console.error("STORY REACTION ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Failed to react on story"
    });
  }
};


// GET /stories/:id/reactions
export const getStoryReactions = async (req, res) => {
  try {
    const { id: storyId } = req.params;

    const reactions = await StoryReaction.findAll({
      where: { storyId },
      order: [["createdAt", "DESC"]]
    });

    res.status(200).json({
      success: true,
      count: reactions.length,
      data: reactions
    });

  } catch (err) {
    console.error("GET STORY REACTIONS ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Failed to get reactions"
    });
  }
};
