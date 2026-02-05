import express from 'express';
import * as userController from '../controllers/api/user.controller.js';
import adminAuth from '../middlewares/adminAuth.js';
import { protect } from "../middlewares/auth.middleware.js";
import { getUserPosts } from "../controllers/api/post.controller.js";


const router = express.Router();
// router.use(adminAuth);

// router.get("/", userController.getAllUsers);
// router.get("/:id", userController.getUserById);
// router.post("/:id/warn", userController.warnUser);
// router.post("/:id/block", userController.blockUser);
// router.post("/:id/ban", userController.banUser);
// router.post("/:id/unblock", userController.unblockUser);
// router.patch("/:id/restrict", userController.restrictFeatures);

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
