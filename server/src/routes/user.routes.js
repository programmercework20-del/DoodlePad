// import express from 'express';
// import * as userController from '../controllers/api/user.controller.js';
// import adminAuth from '../middlewares/adminAuth.js';
// import { protect } from "../middlewares/auth.middleware.js";
// import { getUserPosts } from "../controllers/api/post.controller.js";
// import {
//     getAllUsers,
//     getUserById,
//     warnUser,
//     blockUser,
//     banUser,
//     unblockUser,
//     restrictFeatures
// } from '../controllers/user.controller.js';
// import userAuth from '../middlewares/userAuth.js';

// const router = express.Router();

// // ==========================================
// // 1. SPECIFIC ROUTES (Inhe hamesha upar rakhein)
// // ==========================================

// // Follow Requests wale routes pehle aayenge
// router.get("/follow-requests", protect, userController.getFollowRequests);
// router.patch("/follow-requests/:id/accept", protect, userController.acceptFollowRequest);
// router.patch("/follow-requests/:id/reject", protect, userController.rejectFollowRequest);

// // Follower info (Non-admin)
// router.get("/:id/followers", userController.getFollowers);
// router.get("/:id/following", userController.getFollowing);
// router.get("/:id/follow-counts", userController.getFollowCounts);
// router.get("/:id/followrecord", protect, userController.getFollowStatus);
// router.get("/:id/posts", getUserPosts);

// // ==========================================
// // 2. ADMIN & DYNAMIC ROUTES (Inhe niche rakhein)
// // ==========================================

// router.get("/", adminAuth, getAllUsers);

// // Ye route "/follow-requests" ko catch kar raha tha, isliye ise niche rakha hai
// router.get("/:id", adminAuth, getUserById); 

// router.post("/:id/warn", adminAuth, warnUser);
// router.post("/:id/block", adminAuth, blockUser);
// router.post("/:id/ban", adminAuth, banUser);
// router.post("/:id/unblock", adminAuth, unblockUser);
// router.patch("/:id/restrict", adminAuth, restrictFeatures);

// // Follow actions
// router.post("/:id/follow", protect, userController.followUser);
// router.delete("/:id/unfollow", protect, userController.unfollowUser);

// export default router;

import express from 'express';
import * as userController from '../controllers/api/user.controller.js';
import adminAuth from '../middlewares/adminAuth.js';
import { protect } from "../middlewares/auth.middleware.js";
import { getUserPosts } from "../controllers/api/post.controller.js";
import {
    getAllUsers,
    getUserById,
    warnUser,
    blockUser,
    banUser,
    unblockUser,
    restrictFeatures
} from '../controllers/user.controller.js';
import userAuth from '../middlewares/userAuth.js';
import { getUserProfile } from "../controllers/api/profile.controller.js"; // 🔥 ADD

const router = express.Router();

// ==========================================
// 1. SPECIFIC ROUTES
// ==========================================
router.get("/follow-requests", protect, userController.getFollowRequests);
router.patch("/follow-requests/:id/accept", protect, userController.acceptFollowRequest);
router.patch("/follow-requests/:id/reject", protect, userController.rejectFollowRequest);

router.get("/:id/followers", userController.getFollowers);
router.get("/:id/following", userController.getFollowing);
router.get("/:id/follow-counts", userController.getFollowCounts);
router.get("/:id/followrecord", protect, userController.getFollowStatus);
router.get("/:id/posts", getUserPosts);

// ==========================================
// 2. ADMIN ROUTES
// ==========================================
router.get("/", adminAuth, getAllUsers);
router.post("/:id/warn", adminAuth, warnUser);
router.post("/:id/block", adminAuth, blockUser);
router.post("/:id/ban", adminAuth, banUser);
router.post("/:id/unblock", adminAuth, unblockUser);
router.patch("/:id/restrict", adminAuth, restrictFeatures);

// Follow actions
router.post("/:id/follow", protect, userController.followUser);
router.delete("/:id/unfollow", protect, userController.unfollowUser);

// 🔥 FIX: adminAuth ki jagah protect + getUserProfile
router.get("/:id", protect, getUserProfile);

export default router;