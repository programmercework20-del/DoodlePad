import Story from "../../models/Story.js";
import StoryArchive from "../../models/StoryArchive.js";
import StoryHighlight from "../../models/StoryHighlight.js";
import StoryHighlightItem from "../../models/StoryHighlightItem.js";
import { Op } from "sequelize";
import StoryView from "../../models/StoryView.js";
import user from "../../models/User.js";

/* CREATE STORY */
export const createStory = async (req, res) => {

  // console.log("CREATE STORY BODY:", req.body);
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
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });

    res.status(201).json(story);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create story" });
  }
};


/* GET ACTIVE STORIES */
export const getStories = async (req, res) => {
  try {
    const stories = await Story.findAll({
      where: {
        expiresAt: { [Op.gt]: new Date() }
      },
      order: [["createdAt", "DESC"]]
    });

    const storyIds = stories.map(s => s.id);

    const views = await StoryView.findAll({
      where: {
        storyId: storyIds,
        viewerId: req.user.id
      }
    });

    const viewedSet = new Set(views.map(v => v.storyId));

    const result = stories.map(story => ({
      ...story.toJSON(),
      isSeen: viewedSet.has(story.id)
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch stories" });
  }
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

  const archive = await StoryArchive.findOne({
    where: {
      id: archiveStoryId,
      userId: req.user.id
    }
  });

  if (!archive) {
    return res.status(403).json({ message: "Not allowed" });
  }

  const item = await StoryHighlightItem.create({
    highlightId: req.params.id,
    archiveStoryId
  });

  res.json(item);
};
/* GET MY ARCHIVED STORIES */
export const getMyArchive = async (req, res) => {
  try {
    const archivedStories = await StoryArchive.findAll({
      where: {
        userId: req.user.id
      },
      order: [["createdAt", "DESC"]]
    });

    res.json(archivedStories);
  } catch (err) {
    console.error("GET ARCHIVE ERROR:", err);
    res.status(500).json({ message: "Failed to fetch archive" });
  }
};

export const getStoryViews = async (req, res) => {
  try {
    const { storyId } = req.params;

    const views = await StoryView.findAll({
      where: { storyId },
      include: [{
        model: User,
        attributes: ["id", "username", "profilePhoto"]
      }]
    });

    res.json({
      count: views.length,
      viewers: views
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch viewers" });
  }
};


// const viewed = await StoryView.findOne({
//   where: {
//     storyId: story.id,
//     viewerId: req.user.id
//   }
// });

// return {
//   ...story.toJSON(),
//   isSeen: !!viewed
// };
