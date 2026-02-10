import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import * as ctrl from "../controllers/api/reelComment.controller.js";

const router = express.Router();

// add comment on reel
router.post("/:reelId/comments", protect, ctrl.addReelComment);

// get reel comments
router.get("/:reelId/comments", ctrl.getReelComments);

// delete reel comment
router.delete("/comments/:commentId", protect, ctrl.deleteReelComment);

// like/unlike reel comment
router.post("/comments/:commentId/like", protect, ctrl.likeReelComment);

export default router;
