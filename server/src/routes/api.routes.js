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
import { signup, login, changePassword, updateMyProfile, getMyProfile } from "../controllers/api/user.controller.js";
import userAuth from "../middlewares/userAuth.js";
import storyRoutes from "./story.routes.js";
import { createPost, deletePost, getUserPosts } from "../controllers/api/post.controller.js";
import { sharePost } from "../controllers/api/share.controller.js";



const router = express.Router();

/* ================= AUTH APIs ================= */
router.post("/signup", signup);
router.post("/login", login);
router.put("/users/change-password", userAuth, changePassword);
router.put("/users/update-profile", userAuth, upload.single("profilePhoto"), updateMyProfile);
router.get("/users/my-profile", userAuth, getMyProfile);
router.use("/stories", storyRoutes);



/* ================= POST APIs (USER) ================= */
// Add new post (image, video, audio, text, doodle) and delete post
router.post(
  "/posts",
  protect,  
  upload.single("media"),   // form-data: key = media
  createPost
);

router.delete(
  "/posts/:id",
  protect,
  deletePost
);

router.get(
  "users/:id/posts",
  
  getUserPosts
);

/* ================= TEST ================= */
router.get("/", (req, res) => {
  res.json({ success: true, message: "API routes working" });
});

router.post(
  "/posts/:postId/comments",
  protect,
  upload.single("media"),   // form-data key = media
  addComment
);
router.get("/posts/:postId/comments", getPostComments);
router.delete( "/comments/:commentId", protect,
  deleteComment
);
// Like / Unlike Comment
router.post(
  "/comments/:commentId/like",
  protect,
  likeComment
);

// like and unlike 
router.post("/:id/like", protect, toggleLikePost);

// share rountes 
router.post("/:id/share", protect, sharePost);




router.post("/reports", protect, createReport);
export default router;
