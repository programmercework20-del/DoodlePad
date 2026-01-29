import express from 'express';
import * as liveController from '../controllers/live.controller.js';
import adminAuth from '../middlewares/adminAuth.js';

const router = express.Router();
router.use(adminAuth);

router.get("/", liveController.getAllLiveSessions);
router.post("/:id/end", liveController.endLiveSession);
router.post("/:id/block-host", liveController.blockHost);

export default router;
