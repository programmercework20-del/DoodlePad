import express from 'express';
import * as commentController from '../controllers/comment.controller.js';
import adminAuth from '../middlewares/adminAuth.js';

const router = express.Router();
router.use(adminAuth);

router.get("/", commentController.getAllComments);
router.delete("/:id", commentController.deleteComment);
router.post("/:id/hide", commentController.hideComment);

export default router;
