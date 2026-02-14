// 

import Story from "../../models/Story.js";
import StoryArchive from "../../models/StoryArchive.js";
import StoryHighlight from "../../models/StoryHighlight.js";
import StoryHighlightItem from "../../models/StoryHighlightItem.js";
import { Op } from "sequelize";
import StoryView from "../../models/StoryView.js";
import User from "../../models/User.js";
import CloseFriend from "../../models/CloseFriend.js"; // ✅ NEW IMPORT
import Follower from "../../models/Follower.js";


/* CREATE STORY */
export const createStory = async (req, res) => {
  try {
    const { contentType, textContent, privacy } = req.body;

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
      privacy: privacy || "public", // ✅ DEFAULT PUBLIC
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });

    res.status(201).json(story);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create story" });
  }
};


/* GET ACTIVE STORIES (WITH PRIVACY CHECK) */
export const getStories = async (req, res) => {
  try {
    const viewerId = req.user.id;

    // 1️⃣ Fetch active stories
    const stories = await Story.findAll({
      where: {
        expiresAt: { [Op.gt]: new Date() }
      },
      order: [["createdAt", "DESC"]]
    });

    // 2️⃣ Viewer ke close friends
    const closeFriends = await CloseFriend.findAll({
      where: { userId: viewerId },
      attributes: ["friendId"]
    });

    const closeFriendIds = closeFriends.map(cf => cf.friendId);

    // 3️⃣ Privacy filter (MAIN LOGIC)
    const allowedStories = [];

    for (const story of stories) {

      // owner always allowed
      if (story.userId === viewerId) {
        allowedStories.push(story);
        continue;
      }

      // 🔥 CHECK ACCOUNT PRIVATE
      const storyOwner = await User.findByPk(story.userId);

      if (storyOwner?.is_private) {

        const isFollower = await Follower.findOne({
          where: {
            follower_id: viewerId,
            following_id: story.userId,
            status: "accepted"
          }
        });

        if (!isFollower) {
          continue; // ❌ skip this story
        }
      }

      // public story
      if (story.privacy === "public") {
        allowedStories.push(story);
        continue;
      }

      // close friends
      if (
        story.privacy === "close_friends" &&
        closeFriendIds.includes(story.userId)
      ) {
        allowedStories.push(story);
        continue;
      }
    }


    // 4️⃣ Seen logic (unchanged)
    const storyIds = allowedStories.map(s => s.id);

    const views = await StoryView.findAll({
      where: {
        storyId: storyIds,
        viewerId
      }
    });

    const viewedSet = new Set(views.map(v => v.storyId));

    const result = allowedStories.map(story => ({
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


/* GET STORY VIEWS */
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
