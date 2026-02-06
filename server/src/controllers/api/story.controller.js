import Story from "../../models/Story.js";
import StoryArchive from "../../models/StoryArchive.js";
import StoryHighlight from "../../models/StoryHighlight.js";
import StoryHighlightItem from "../../models/StoryHighlightItem.js";
import { Op } from "sequelize";

/* CREATE STORY */
export const createStory = async (req, res) => {
  try {
    const { contentType, textContent } = req.body;

    if (contentType !== "text" && !req.file) {
      return res.status(400).json({ message: "Media file required" });
    }

    const mediaUrl = req.file
      ? `/uploads/stories/${req.file.filename}`
      : null;

    const story = await Story.create({
      userId: req.user.id,
      contentType,
      mediaUrl,
      textContent,
      expiresAt: new Date(Date.now() + 2 * 60  * 1000)
    });

    res.status(201).json(story);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create story" });
  }
};


/* GET ACTIVE STORIES */
export const getStories = async (req, res) => {
  const stories = await Story.findAll({
    where: { expiresAt: { [Op.gt]: new Date() } },
    order: [["createdAt", "DESC"]]
  });

  res.json(stories);
};

/* GET MY ARCHIVE */
export const getMyArchive = async (req, res) => {
  const data = await StoryArchive.findAll({
    where: { userId: req.user.id },
    order: [["expiredAt", "DESC"]]
  });

  res.json(data);
};

/* CREATE HIGHLIGHT */
export const createHighlight = async (req, res) => {
  const highlight = await StoryHighlight.create({
    userId: req.user.id,
    title: req.body.title,
    coverImage: req.body.coverImage
  });

  res.status(201).json(highlight);
};

/* ADD STORY TO HIGHLIGHT */
export const addToHighlight = async (req, res) => {
  const { archiveStoryId } = req.body;

  const item = await StoryHighlightItem.create({
    highlightId: req.params.id,
    archiveStoryId
  });

  res.json(item);
};
