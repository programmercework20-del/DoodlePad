import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { getFeed } from "../controllers/api/feed.controller.js";

const router = express.Router();

router.get("/", protect, getFeed);

export default router;
