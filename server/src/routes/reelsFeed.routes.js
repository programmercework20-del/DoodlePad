import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { getReelsFeed } from "../controllers/api/reelsFeed.controller.js";

const router = express.Router();

router.get("/", protect, getReelsFeed);

export default router;
