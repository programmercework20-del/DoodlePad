import express from 'express';
import * as adminController from '../controllers/admin.controller.js';
import adminAuth from '../middlewares/adminAuth.js';

const router = express.Router();

router.post("/login", adminController.login);
router.post("/logout", adminAuth, adminController.logout);
router.get("/profile", adminAuth, adminController.getProfile);
router.get("/verify", adminAuth, adminController.verify);

export default router;
