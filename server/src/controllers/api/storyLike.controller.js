import StoryLike from "../../models/StoryLike.js";

// POST /stories/:id/like  (toggle)
export const toggleStoryLike = async (req, res) => {
  try {
    const { id: storyId } = req.params;
    const userId = req.user.id;

    const existingLike = await StoryLike.findOne({
      where: { storyId, userId }
    });

    // UNLIKE
    if (existingLike) {
      await existingLike.destroy();
      return res.status(200).json({
        success: true,
        liked: false,
        message: "Story unliked"
      });
    }

    // LIKE
    await StoryLike.create({
      storyId,
      userId
    });

    return res.status(201).json({
      success: true,
      liked: true,
      message: "Story liked"
    });

  } catch (err) {
    console.error("STORY LIKE TOGGLE ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to toggle like"
    });
  }
};
