import { Op } from "sequelize";
import { v4 as uuidv4 } from "uuid";
import StoryShare from "../../models/StoryShare.js";
import Story from "../../models/Story.js";

/* GENERATE SHAREABLE TOKEN */
export const generateStoryShare = async (req, res) => {
  try {
    const { id: storyId } = req.params;

    // optional: validate story exists
    const story = await Story.findByPk(storyId);
    if (!story) {
      return res.status(404).json({ message: "Story not found" });
    }

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const share = await StoryShare.create({
      storyId,
      token,
      expiresAt
    });

    res.json({
      success: true,
      shareUrl: `${process.env.BASE_URL}/api/stories/share/${share.token}`,
      expiresAt
    });
  } catch (err) {
    console.error("GENERATE SHARE ERROR:", err);
    res.status(500).json({ message: "Failed to generate share link" });
  }
};


/* ACCESS STORY BY TOKEN (PUBLIC) */
export const getSharedStory = async (req, res) => {
  try {
    const { token } = req.params;

    const share = await StoryShare.findOne({
      where: {
        token,
        expiresAt: { [Op.gt]: new Date() }
      }
    });

    if (!share) {
      return res.status(404).json({ message: "Link expired or invalid" });
    }

    const story = await Story.findByPk(share.storyId);

    if (!story) {
      return res.status(404).json({ message: "Story not found" });
    }

    res.json({
      success: true,
      story
    });
  } catch (err) {
    console.error("GET SHARED STORY ERROR:", err);
    res.status(500).json({ message: "Failed to fetch shared story" });
  }
};
