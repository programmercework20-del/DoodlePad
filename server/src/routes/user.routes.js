import express from 'express';
import {
    getAllUsers,
    getUserById,
    warnUser,
    blockUser,
    banUser,
    unblockUser,
    restrictFeatures
} from '../controllers/user.controller.js';
import adminAuth from '../middlewares/adminAuth.js';

const router = express.Router();
router.use(adminAuth);

router.get("/", getAllUsers);
router.get("/:id", getUserById);
router.post("/:id/warn", warnUser);
router.post("/:id/block", blockUser);
router.post("/:id/ban", banUser);
router.post("/:id/unblock", unblockUser);
router.patch("/:id/restrict", restrictFeatures);

export default router;
