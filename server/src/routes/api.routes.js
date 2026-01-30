import express from "express";
import { signup, login } from "../controllers/api/user.controller.js";

const router = express.Router();

// Auth APIs
router.post("/signup", signup);
router.post("/login", login);

// Test route (optional, debug ke liye)
router.get("/", (req, res) => {
  res.json({ success: true, message: "API routes working" });
});

export default router;
