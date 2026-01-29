import express from 'express';
import * as analyticsController from '../controllers/analytics.controller.js';
import adminAuth from '../middlewares/adminAuth.js';

const router = express.Router();
router.use(adminAuth);

router.get("/dashboard", analyticsController.getDashboardStats);
router.get("/trends", analyticsController.getActivityTrends);

export default router;
