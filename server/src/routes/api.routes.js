import express from "express";
import { signup, login } from "../controllers/api/user.controller.js";
import { createPost, deletePost } from "../controllers/api/post.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";
import {
  addComment,
  getPostComments,
  deleteComment,
  likeComment
} from "../controllers/api/comment.controller.js";
import { createReport } from "../controllers/api/report.controller.js";




const router = express.Router();

/* ================= AUTH APIs ================= */
router.post("/signup", signup);
router.post("/login", login);

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

router.post("/reports", protect, createReport);
export default router;
