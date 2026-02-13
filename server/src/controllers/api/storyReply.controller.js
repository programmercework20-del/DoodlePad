import StoryReply from "../../models/StoryReply.js";
import Story from "../../models/Story.js";

// POST /stories/:id/reply
export const replyToStory = async (req, res) => {
  try {
    const { id: storyId } = req.params;
    const { message } = req.body;
    const senderId = req.user.id;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Message is required"
      });
    }

    // story find (to get owner as receiver)
    const story = await Story.findByPk(storyId);
    if (!story) {
      return res.status(404).json({
        success: false,
        message: "Story not found"
      });
    }

    const receiverId = story.userId;

    const reply = await StoryReply.create({
      storyId,
      senderId,
      receiverId,
      message
    });

    return res.status(201).json({
      success: true,
      message: "Story replied successfully",
      data: reply
    });

  } catch (err) {
    console.error("STORY REPLY ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to reply to story"
    });
  }
};
