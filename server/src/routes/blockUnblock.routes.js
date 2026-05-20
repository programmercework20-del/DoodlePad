import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { blockUser, unblockUser, getBlockedUsers} from "../controllers/api/block.controller.js";

const router = express.Router();

router.get("/", protect, getBlockedUsers);
router.post("/:id", protect, blockUser);
router.post("/unblock/:id", protect, unblockUser);

export default router;