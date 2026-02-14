import express from "express";
import userAuth from "../middlewares/userAuth.js";
import {
  createStory,
  getStories,
  getMyArchive,
  createHighlight,
  addToHighlight
} from "../controllers/api/story.controller.js";
import upload from "../middlewares/upload.js";
import {markStorySeen, getStoryViews} from "../controllers/api/storyView.controller.js";
import { reactToStory, getStoryReactions }  from "../controllers/api/StoryReaction.controller.js";
import { replyToStory } from "../controllers/api/storyReply.controller.js";
import { toggleStoryLike } from "../controllers/api/storyLike.controller.js";
import {
  generateStoryShare,
  getSharedStory
} from "../controllers/api/storyShare.controller.js";



const router = express.Router();
router.post("/", userAuth,  upload.single("mediaUrl"), createStory);  // 👈 IMPORTANT // createStory
router.get("/archive", userAuth, getMyArchive); // Get my archived stories  
router.post("/seen", userAuth, markStorySeen);
router.get("/:storyId/views", userAuth, getStoryViews); 

router.get("/", userAuth, getStories);
router.get("/", userAuth, getMyArchive);

router.post("/highlights", userAuth, createHighlight);
router.post("/highlights/:id/add", userAuth, addToHighlight);

router.post("/:id/react", userAuth, reactToStory);
router.get("/:id/reactions", userAuth, getStoryReactions);

router.post("/:id/reply", userAuth, replyToStory);

router.post("/:id/like", userAuth, toggleStoryLike);



export default router;
