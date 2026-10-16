import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import upload from "../middlewares/upload.js";
import * as postController from '../controllers/post.controller.js';

import {
  addComment,
  getPostComments,
  deleteOwnComment,
  likeComment
} from "../controllers/api/comment.controller.js";
import { googleLogin } from "../controllers/user.controller.js";
import { getPostsByHashtag } from "../controllers/api/hashtag.controller.js";

import { createReport } from "../controllers/api/report.controller.js";
import { toggleLikePost, getPostLikes } from "../controllers/api/postLike.controller.js";

import {
  signup,
  login,
  sendVerificationOtp,
  sendOtp,
  verifyOtp,
  forgotPassword,
  resendOtp,
  verifyResetOtp,
  resetPassword, 
  logout,
  getFollowRequests,
  acceptFollowRequest,
  rejectFollowRequest,
  getUniqueConnectionsCount,
  togglePrivacy,
  saveFcmToken,
  deleteFcmToken
} from "../controllers/api/user.controller.js";

// ✅ 1. IMPORT IS PERFECT HERE (NO ARCHIVE FUNCTIONS)
import { 
  createPost, 
  deletePost, 
  getUserPosts,
  togglePinPost,
  incrementViewCount,
  generateResumableUploadUrl 
} from "../controllers/api/post.controller.js";

import { sharePost, handleSharedLink } from "../controllers/api/share.controller.js";
import userAuth from "../middlewares/userAuth.js";
import messageRoutes from './message.route.js'; 

const router = express.Router();

router.post("/google-login", googleLogin);

/* ================= AUTH APIs ================= */
router.post("/signup", signup);
router.post("/send-verification-otp", sendVerificationOtp);
router.post("/verify-otp", verifyOtp);
router.post("/login", login);
router.post("/logout", protect, logout);
router.post("/send-otp", sendOtp);

router.post("/forgot-password", forgotPassword);
router.post("/resend-otp", resendOtp);
router.post("/verify-reset-otp", verifyResetOtp);
router.post("/reset-password", resetPassword);

router.get("/requests", protect, getFollowRequests);
router.post("/requests/:id/accept", protect, acceptFollowRequest);
router.post("/requests/:id/reject", protect, rejectFollowRequest);
router.get('/connections/:id/count', getUniqueConnectionsCount);

/* ================= PRIVACY ================= */
router.patch("/users/privacy", userAuth, togglePrivacy);
router.post("/save-fcm-token", protect, saveFcmToken);
router.delete("/delete-fcm-token", protect, deleteFcmToken);

/* ================= POST APIs ================= */
router.post(
  "/posts", 
  protect, 
  upload.fields([
    { name: "media", maxCount: 20 },
    { name: "backgroundMusic", maxCount: 1 }
  ]), 
  createPost
);
router.delete("/posts/:id", protect, deletePost);
router.get("/users/:id/posts", getUserPosts);
router.post("/posts/resumable-url", protect, generateResumableUploadUrl);

// ✅ 2. ROUTE MATCHES FRONTEND REPORT EXACTLY
router.post("/posts/:id/toggle-pin", protect, togglePinPost);
router.post("/posts/:id/view", protect, incrementViewCount);
// Feed & Hashtags Routing
router.get("/posts", protect, (req, res, next) => {
    if (req.query.hashtag) {
        console.log(`🔀 [API GATEWAY] Hashtag detected: #${req.query.hashtag} -> Routing to Hashtag Controller`);
        return getPostsByHashtag(req, res);
    }
    console.log("➡️ [API GATEWAY] Normal feed requested -> Routing to Feed Controller");
    return postController.getFeedPosts(req, res, next);
});

router.get("/posts/:id", protect, postController.getPostById);

// Comments
router.post("/posts/:postId/comments", protect, upload.single("media"), addComment);
router.get("/posts/:postId/comments", getPostComments);
router.post("/comments/:commentId/like", protect, likeComment);
router.delete("/comments/:commentId", protect, deleteOwnComment);
// FE Dev ki requested NEW route
router.delete("/posts/:postId/comments/:commentId", protect, deleteOwnComment);

// Likes & Shares
router.post("/posts/:id/like", protect, toggleLikePost);
router.get("/posts/:id/likes", getPostLikes);
router.post("/posts/:id/share", protect, sharePost);
router.get("/share/p/:id", handleSharedLink);

/* ================= REPORT ================= */
router.post("/reports", userAuth, createReport);

/* ================= MESSAGES ================= */
router.use("/messages", messageRoutes);

/* ================= TEST ================= */
router.get("/", (req, res) => {
  res.json({ success: true, message: "API routes working" });
});

export default router;