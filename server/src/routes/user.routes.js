import express from 'express';
import * as userController from '../controllers/user.controller.js';
import adminAuth from '../middlewares/adminAuth.js';

const router = express.Router();
router.use(adminAuth);

router.get("/", userController.getAllUsers);
router.get("/:id", userController.getUserById);
router.post("/:id/warn", userController.warnUser);
router.post("/:id/block", userController.blockUser);
router.post("/:id/ban", userController.banUser);
router.post("/:id/unblock", userController.unblockUser);
router.patch("/:id/restrict", userController.restrictFeatures);

export default router;
