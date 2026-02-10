import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";
import {
  createReel,
  deleteReel,
  getUserReels
} from "../controllers/api/reel.controller.js";
import reelCommentRoutes from "./reelComment.routes.js";


const router = express.Router();

router.post("/", protect, upload.single("video"), createReel);
router.delete("/reels/:id", protect, deleteReel);
router.get("/users/:id/reels", getUserReels);

router.use("/", reelCommentRoutes);


export default router;
