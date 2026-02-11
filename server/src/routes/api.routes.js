import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";

import {
  addComment,
  getPostComments,
  deleteComment,
  likeComment
} from "../controllers/api/comment.controller.js";

import { createReport } from "../controllers/api/report.controller.js";
import { toggleLikePost } from "../controllers/api/postLike.controller.js";

import {
  signup,
  login,
  logout,
  changePassword,
  updateMyProfile,
  getMyProfile
} from "../controllers/api/user.controller.js";

import { createPost, deletePost, getUserPosts } 
from "../controllers/api/post.controller.js";

import { sharePost } from "../controllers/api/share.controller.js";

import { toggleReelLike } 
from "../controllers/api/reelLike.controller.js";

import { shareReel } 
from "../controllers/api/reelShare.controller.js";

import userAuth from "../middlewares/userAuth.js";
import storyRoutes from "./story.routes.js";

const router = express.Router();

/* ================= AUTH APIs ================= */

router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", protect, logout);

router.put("/users/change-password", userAuth, changePassword);
router.put(
  "/users/update-profile",
  userAuth,
  upload.single("profilePhoto"),
  updateMyProfile
);

router.get("/users/my-profile", userAuth, getMyProfile);
router.use("/stories", storyRoutes);


/* ================= POST APIs ================= */

router.post(
  "/posts",
  protect,
  upload.single("media"),
  createPost
);

router.delete(
  "/posts/:id",
  protect,
  deletePost
);

router.get(
  "/users/:id/posts",
  getUserPosts
);


/* ================= COMMENTS ================= */

router.post(
  "/posts/:postId/comments",
  protect,
  upload.single("media"),
  addComment
);

router.get("/posts/:postId/comments", getPostComments);

router.delete(
  "/comments/:commentId",
  protect,
  deleteComment
);

router.post(
  "/comments/:commentId/like",
  protect,
  likeComment
);


/* ================= POST LIKE ================= */

router.post("/:id/like", protect, toggleLikePost);


/* ================= POST SHARE ================= */

router.post("/:id/share", protect, sharePost);


/* ================= REEL ================= */

router.post("/reels/:reelId/like", protect, toggleReelLike);
router.post("/reels/:id/share", protect, shareReel);


/* ================= REPORT ================= */

router.post("/reports", userAuth, createReport);


/* ================= TEST ================= */

router.get("/", (req, res) => {
  res.json({ success: true, message: "API routes working" });
});

export default router;
