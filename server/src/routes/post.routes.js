import express from 'express';
import * as postController from '../controllers/post.controller.js';
import adminAuth from '../middlewares/adminAuth.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

// ==========================================
// 🛡️ NORMAL USER ROUTES (Uses 'protect')
// ==========================================

// 🔥 FIX: adminAuth ko hatakar 'protect' laga diya
router.delete("/:id", protect, postController.deletePost);

// 🔥 SECURITY FIX: Isme koi lock nahi tha, isme bhi 'protect' laga diya
router.patch("/:id/comments", protect, postController.disableComments);


// ==========================================
// 🛑 ADMIN ONLY ROUTES (Uses 'adminAuth')
// ==========================================

router.post("/:id/hide", adminAuth, postController.hidePost);
router.post("/:id/mark-sensitive", adminAuth, postController.markSensitive);

export default router;