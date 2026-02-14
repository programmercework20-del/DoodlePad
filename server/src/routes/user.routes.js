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
import { togglePrivateAccount } from "../controllers/api/user.controller.js";
import userAuth from "../middlewares/userAuth.js";
import { respondFollowRequest } from "../controllers/api/user.controller.js";





const router = express.Router();

router.get("/",adminAuth, getAllUsers);
router.get("/:id",adminAuth, getUserById);
router.post("/:id/warn",adminAuth, warnUser);
router.post("/:id/block",adminAuth, blockUser);
router.post("/:id/ban",adminAuth, banUser);
router.post("/:id/unblock",adminAuth, unblockUser);
router.patch("/:id/restrict",adminAuth, restrictFeatures);

// rountes for follower 

console.log("followUser =", userController.followUser);

router.post("/:id/follow", protect, userController.followUser);
router.delete("/:id/unfollow", protect, userController.unfollowUser);

router.get("/:id/followers", userController.getFollowers);
router.get("/:id/followrecord",protect,  userController.getFollowStatus);
router.get("/:id/following", userController.getFollowing);

router.get("/:id/follow-counts", userController.getFollowCounts);


// rountes for posts 
router.get("/:id/posts", getUserPosts);

// route for toggling private account
router.patch("/toggle-private", userAuth, togglePrivateAccount);

router.post("/follow/respond", userAuth, respondFollowRequest);


export default router;
