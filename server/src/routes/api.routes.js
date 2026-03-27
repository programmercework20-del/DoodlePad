import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import upload from "../middlewares/upload.js";
import * as postController from '../controllers/post.controller.js';
import { getUserProfile } from "../controllers/api/profile.controller.js";
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
  sendOtp,
  verifyOtp,
  verifyEmail,
  sendEmailVerification,
  forgotPassword,
  logout,
  changePassword,
  updateMyProfile,
  getMyProfile,
  resetPassword
} from "../controllers/api/user.controller.js";

import { createPost, deletePost, getUserPosts } 
from "../controllers/api/post.controller.js";

import { sharePost } from "../controllers/api/share.controller.js";


import userAuth from "../middlewares/userAuth.js";
import storyRoutes from "./story.routes.js";

const router = express.Router();

/* ================= AUTH APIs ================= */

router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", protect, logout);
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);

router.post("/send-email-verification", protect, sendEmailVerification);
router.get("/verify-email/:token", verifyEmail);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);

router.post("/forgot-password", forgotPassword);

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

router.post("/posts", protect, upload.array("media", 5), createPost);
router.delete("/posts/:id", protect, deletePost);
router.get("/users/:id/posts", getUserPosts);
router.get("/posts",protect, postController.getFeedPosts);

router.post("/posts/:postId/comments", protect, upload.single("media"), addComment);
router.get("/posts/:postId/comments", getPostComments);

router.post("/posts/:id/like", protect, toggleLikePost);
router.post("/posts/:id/share", protect, sharePost);



/* ================= REPORT ================= */

router.post("/reports", userAuth, createReport);


/* ================= TEST ================= */

router.get("/", (req, res) => {
  res.json({ success: true, message: "API routes working" });
});

export default router;
