import express from 'express';
import adminAuth from '../middlewares/adminAuth.js';
import { getAllPayments, simulatePayment } from '../controllers/payment.controller.js';

const router = express.Router();

router.use(adminAuth);
router.post('/mock', simulatePayment);
router.get('/', getAllPayments);

export default router;
