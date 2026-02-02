import express from "express";
import { signup, login, changePassword, updateMyProfile, getMyProfile } from "../controllers/api/user.controller.js";
import userAuth from "../middlewares/userAuth.js";


const router = express.Router();

// Auth APIs
router.post("/signup", signup);
router.post("/login", login);
router.put("/users/change-password", userAuth, changePassword);
router.patch("/users/update-profile", userAuth, updateMyProfile);
router.get("/users/my-profile", userAuth, getMyProfile);



// Test route (optional, debug ke liye)
router.get("/", (req, res) => {
  res.json({ success: true, message: "API routes working" });
});

export default router;
