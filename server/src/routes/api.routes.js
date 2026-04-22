import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import upload from "../middlewares/upload.js";
import * as postController from '../controllers/post.controller.js';
import { getUserProfile, sendDoodleRequest, acceptDoodleRequest,getDoodleRequests, updateMyProfile, getMyProfile, rejectDoodleRequest } from "../controllers/api/profile.controller.js";
import {
  addComment,
  getPostComments,
  deleteOwnComment,
  likeComment
} from "../controllers/api/comment.controller.js";
import { googleLogin } from "../controllers/user.controller.js";


import { createReport } from "../controllers/api/report.controller.js";
import { toggleLikePost } from "../controllers/api/postLike.controller.js";

import {
  signup,
  login,
  sendVerificationOtp,
  sendOtp,
  verifyOtp,
  forgotPassword,
  verifyResetOtp,
  resetPassword, 
  logout,
  getFollowRequests,
  acceptFollowRequest,
  rejectFollowRequest,
  togglePrivacy,
  saveFcmToken
} from "../controllers/api/user.controller.js";

import { createPost, deletePost, getUserPosts, getArchivedPosts, restoreArchivedPost, archivePost } 
from "../controllers/api/post.controller.js";

import { sharePost } from "../controllers/api/share.controller.js";


import userAuth from "../middlewares/userAuth.js";

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
router.post("/verify-reset-otp", verifyResetOtp);
router.post("/reset-password", resetPassword);

router.get("/requests", protect, getFollowRequests);
router.post("/requests/:id/accept", protect, acceptFollowRequest);
router.post("/requests/:id/reject", protect, rejectFollowRequest);



/* ================= PRIVACY ================= */

router.patch("/users/privacy", userAuth, togglePrivacy);

router.post("/save-fcm-token", protect, saveFcmToken);


/* ================= PROFILE APIs ================= */

router.put(
  "/users/update-profile",
  protect,
  upload.single("profilePhoto"),
  updateMyProfile
);
// router.put(
//   "/users/update-profile",
//   userAuth,
//   upload.single("profilePhoto"),
//   updateMyProfile
// );

router.get("/users/my-profile", protect, getMyProfile);
// router.get("/users/my-profile", userAuth, getMyProfile);

router.get("/users/:id", protect, getUserProfile);
// router.get("/users/:id", userAuth, getUserProfile);

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
router.delete(
  "/comments/:commentId",
  protect,
  deleteOwnComment
);

router.post("/posts/:id/like", protect, toggleLikePost);
router.post("/posts/:id/share", protect, sharePost);



/* ================= REPORT ================= */

router.post("/reports", userAuth, createReport);

/* ================= TEST ================= */

router.get("/", (req, res) => {
  res.json({ success: true, message: "API routes working" });
});

export default router;
