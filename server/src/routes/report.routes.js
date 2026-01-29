import express from 'express';
import * as reportController from '../controllers/report.controller.js';
import adminAuth from '../middlewares/adminAuth.js';

const router = express.Router();
router.use(adminAuth);

router.get("/", reportController.getAllReports);
router.get("/:id", reportController.getReportById);
router.patch("/:id/status", reportController.updateReportStatus);
router.patch("/:id/priority", reportController.updatePriority);

export default router;
