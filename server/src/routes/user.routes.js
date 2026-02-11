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


const router = express.Router();
router.use(adminAuth);

router.get("/", getAllUsers);
router.get("/:id", getUserById);
router.post("/:id/warn", warnUser);
router.post("/:id/block", blockUser);
router.post("/:id/ban", banUser);
router.post("/:id/unblock", unblockUser);
router.patch("/:id/restrict", restrictFeatures);

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


export default router;
