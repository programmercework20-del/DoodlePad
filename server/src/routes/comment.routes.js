import express from 'express';
import * as commentController from '../controllers/comment.controller.js';
import adminAuth from '../middlewares/adminAuth.js';

const router = express.Router();
// router.use(adminAuth);

router.get("/", commentController.getAllComments);
router.delete("/:id",adminAuth, commentController.adminDeleteComment);
router.post("/:id/hide",adminAuth, commentController.hideComment);

export default router;
