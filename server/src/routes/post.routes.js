import express from 'express';
import * as postController from '../controllers/post.controller.js';
// 🔥 NAMED IMPORT: Ab hum seedha function ko hi import kar rahe hain
import { getCommentReplies } from '../controllers/comment.controller.js'; 
import adminAuth from '../middlewares/adminAuth.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

// ==========================================
// 🛡️ NORMAL USER ROUTES (Uses 'protect')
// ==========================================

// 🔥 ROUTE UPDATE: Yahan se commentController. hata diya hai
router.get("/comments/:commentId/replies", protect, getCommentReplies);

router.delete("/:id", protect, postController.deletePost);

router.patch("/:id/comments", protect, postController.disableComments);


// ==========================================
// 🛑 ADMIN ONLY ROUTES (Uses 'adminAuth')
// ==========================================

router.post("/:id/hide", adminAuth, postController.hidePost);
router.post("/:id/mark-sensitive", adminAuth, postController.markSensitive);

export default router;