import express from 'express';
import * as postController from '../controllers/post.controller.js';
import adminAuth from '../middlewares/adminAuth.js';

const router = express.Router();
router.use(adminAuth);

router.get("/", postController.getAllPosts);
router.get("/:id", postController.getPostById);
router.post("/:id/hide", postController.hidePost);
router.delete("/:id", postController.deletePost);
router.post("/:id/mark-sensitive", postController.markSensitive);
router.patch("/:id/comments", postController.disableComments);

export default router;
