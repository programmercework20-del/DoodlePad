import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { trackReelView } from "../controllers/api/reelView.controller.js";

const router = express.Router();

router.post("/:reelId/view", protect, trackReelView);

export default router;
