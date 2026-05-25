import express from "express";

import { protect } from "../middlewares/auth.middleware.js";

import {
  searchHashtags,
  getPostsByHashtag,
  getTrendingHashtags
} from "../controllers/api/hashtag.controller.js";

const router = express.Router();

// router.get("/search", protect, searchHashtags);

router.get("/trending", protect, getTrendingHashtags);

router.get("/:name/posts", protect, getPostsByHashtag);

export default router;