import express from 'express';
import * as postController from '../controllers/post.controller.js';
import adminAuth from '../middlewares/adminAuth.js';
import { protect } from '../middlewares/auth.middleware.js';


const router = express.Router();
// router.use(adminAuth);

router.get("/", postController.getFeedPosts);
router.get("/:id", postController.getPostById);
router.post("/:id/hide",adminAuth, postController.hidePost);
router.delete("/:id",adminAuth, postController.deletePost);
router.post("/:id/mark-sensitive",adminAuth, postController.markSensitive);
router.patch("/:id/comments", postController.disableComments);






export default router;
