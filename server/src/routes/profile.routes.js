import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import userAuth from "../middlewares/userAuth.js";
import upload from "../middlewares/upload.js";
import { 
    getUserProfile, 
    sendDoodleRequest, 
    acceptDoodleRequest, 
    getDoodleRequests, 
    updateMyProfile, 
    getMyProfile, 
    rejectDoodleRequest,
    toggleProfileLike
    
} from "../controllers/api/profile.controller.js";
import { getDiscoverPeople } from "../controllers/api/discover.controller.js";

const router = express.Router();

// 🔥 IMPORTANT: Specific routes PEHLE, dynamic /:id BAAD MEIN

// 1. My Profile
router.get("/my-profile", protect, getMyProfile);

// 2. Discover People
router.get("/discover-people", protect, getDiscoverPeople);

// 3. Update Profile
router.put("/update-profile", protect, upload.single("profilePhoto"), updateMyProfile);

// 4. Doodle Routes — /:id se pehle hone chahiye
router.post("/doodle/request", userAuth, upload.single("doodle"), sendDoodleRequest);
router.get("/doodle/request", userAuth, getDoodleRequests);
router.post("/doodle/accept/:requestId", userAuth, acceptDoodleRequest);
router.post("/doodle/reject/:requestId", userAuth, rejectDoodleRequest);

// 5. Get Other User Profile — SABSE LAST mein
router.get("/:id", protect, getUserProfile);
router.post("/profile/:id/like", protect, toggleProfileLike);

export default router;