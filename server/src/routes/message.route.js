import express from "express";
import {
  sendMessage,
  editMessage,
  deleteMessage,
  markSeen,
  getMessages,
  acceptRequest,
  rejectRequest
} from "../controllers/api/message.controller.js";

import { protect } from "../middlewares/auth.middleware.js";
import  upload  from "../middlewares/upload.js";

const router = express.Router();

router.post("/send", protect, upload.single("file"), sendMessage);
router.get("/:conversationId", protect, getMessages);
router.put("/:messageId", protect, editMessage);
router.delete("/:messageId", protect, deleteMessage);
router.post("/seen/:conversationId", protect, markSeen);

// request
router.post("/request/:conversationId/accept", protect, acceptRequest);
router.post("/request/:conversationId/reject", protect, rejectRequest);

export default router;