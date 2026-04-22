import express from 'express';
import adminAuth from '../middlewares/adminAuth.js';
import { getRevenueByAdId, getRevenueOverview } from '../controllers/revenue.controller.js';

const router = express.Router();

router.use(adminAuth);
router.get('/overview', getRevenueOverview);
router.get('/ad/:id', getRevenueByAdId);

export default router;
