import express from "express";
import { getConversations } from "../controllers/api/conversation.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", protect, getConversations);

export default router;