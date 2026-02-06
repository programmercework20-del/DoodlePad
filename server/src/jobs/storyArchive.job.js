import Story from "../models/Story.js";
import StoryArchive from "../models/StoryArchive.js";
import { Op } from "sequelize";

export const archiveExpiredStories = async () => {
  try {
    const expiredStories = await Story.findAll({
      where: {
        expiresAt: { [Op.lt]: new Date() }
      }
    });

    for (const story of expiredStories) {
      await StoryArchive.create({
        userId: story.userId,
        contentType: story.contentType,
        mediaUrl: story.mediaUrl,
        textContent: story.textContent,
        createdAt: story.createdAt,
        expiredAt: new Date()
      });

      await story.destroy();
    }

    console.log("✅ Story archive job ran successfully");
  } catch (error) {
    console.error("❌ Story archive job failed:", error);
  }
};
