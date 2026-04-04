import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import upload from "../middlewares/upload.js";
import * as postController from '../controllers/post.controller.js';
import { getUserProfile, sendDoodleRequest, acceptDoodleRequest,getDoodleRequests, updateMyProfile, getMyProfile, rejectDoodleRequest } from "../controllers/api/profile.controller.js";
import {
  addComment,
  getPostComments,
  deleteComment,
  likeComment
} from "../controllers/api/comment.controller.js";
import { googleLogin } from "../controllers/user.controller.js";


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
  resetPassword, 
  getFollowRequests,
  acceptFollowRequest,
  rejectFollowRequest
} from "../controllers/api/user.controller.js";

import { createPost, deletePost, getUserPosts, getArchivedPosts, restoreArchivedPost, archivePost } 
from "../controllers/api/post.controller.js";

import { sharePost } from "../controllers/api/share.controller.js";


import userAuth from "../middlewares/userAuth.js";

const router = express.Router();



router.post("/google-login", googleLogin);

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

router.get("/requests", protect, getFollowRequests);
router.post("/requests/:id/accept", protect, acceptFollowRequest);
router.post("/requests/:id/reject", protect, rejectFollowRequest);

router.post("/forgot-password", forgotPassword);

router.put("/users/change-password", userAuth, changePassword);

/* ================= PROFILE APIs ================= */

router.put(
  "/users/update-profile",
  userAuth,
  upload.single("profilePhoto"),
  updateMyProfile
);

router.get("/users/my-profile", userAuth, getMyProfile);

router.get("/users/:id", userAuth, getUserProfile);

router.post("/doodle/request", userAuth, upload.single("doodle"), sendDoodleRequest);

router.post("/doodle/accept/:requestId", userAuth, acceptDoodleRequest);

router.post("/doodle/reject/:requestId", userAuth, rejectDoodleRequest);

router.get("/doodle/request", userAuth, getDoodleRequests);



/* ================= POST APIs ================= */

router.post("/posts", protect, upload.array("media", 5), createPost);
router.delete("/posts/:id", protect, deletePost);
router.get("/users/:id/posts", getUserPosts);


router.get("/posts/archive", protect, getArchivedPosts);
router.post("/posts/:id/archive", protect, archivePost);
router.post("/posts/:id/restore", protect, restoreArchivedPost);


router.get("/posts",protect, postController.getFeedPosts);
router.get("/:id",protect, postController.getPostById);
router.post("/posts/:postId/comments", protect, upload.single("media"), addComment);
router.get("/posts/:postId/comments", getPostComments);
router.post("/comments/:commentId/like",protect, likeComment);


router.post("/posts/:id/like", protect, toggleLikePost);
router.post("/posts/:id/share", protect, sharePost);



/* ================= REPORT ================= */

router.post("/reports", userAuth, createReport);

/* ================= TEST ================= */

router.get("/", (req, res) => {
  res.json({ success: true, message: "API routes working" });
});

export default router;
