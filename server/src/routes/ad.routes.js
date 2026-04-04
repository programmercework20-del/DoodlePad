// import express from "express";
// import { protect, adminOnly } from "../../middlewares/auth.middleware.js";
// import {
//   createAd,
//   getAds,
//   deleteAd
// } from "../../controllers/admin/ad.controller.js";

// const router = express.Router();

// // 🔥 Admin APIs
// router.post("/", protect, adminOnly, createAd);
// router.get("/", protect, adminOnly, getAds);
// router.delete("/:id", protect, adminOnly, deleteAd);

// export default router