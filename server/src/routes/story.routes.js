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

const router = express.Router();

router.post(
  "/",
  userAuth,
  upload.single("mediaUrl"),   // 👈 IMPORTANT
  createStory
);
router.get("/", userAuth, getStories);
router.get("/archive", userAuth, getMyArchive);

router.post("/highlights", userAuth, createHighlight);
router.post("/highlights/:id/add", userAuth, addToHighlight);

export default router;
