import express from 'express';
import * as messageController from '../controllers/message.controller.js';
import adminAuth from '../middlewares/adminAuth.js';

const router = express.Router();
router.use(adminAuth);

router.get("/reported", messageController.getReportedMessages);
router.post("/:id/flag", messageController.flagMessage);
router.delete("/:id", messageController.deleteMessage);

export default router;
