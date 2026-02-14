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


const router = express.Router();
router.post("/", userAuth,  upload.single("mediaUrl"), createStory);  // 👈 IMPORTANT // createStory
router.get("/archive", userAuth, getMyArchive); // Get my archived stories  
router.post("/seen", userAuth, markStorySeen);
router.get("/:storyId/views", userAuth, getStoryViews); 

router.get("/", userAuth, getStories);
router.get("/", userAuth, getMyArchive);

router.post("/highlights", userAuth, createHighlight);
router.post("/highlights/:id/add", userAuth, addToHighlight);

export default router;
