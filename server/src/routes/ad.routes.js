import express from "express";

import uploadAd from "../middlewares/uploadAd.js";

import {
  createAd,
  getAds,
  deleteAd,
  trackClick,
  trackImpression
} from "../controllers/api/ad.controller.js";

import adminAuth from "../middlewares/adminAuth.js";

const router = express.Router();


router.post(
  "/",
  adminAuth,
  uploadAd.single("image"),
  createAd
);

router.get("/", adminAuth, getAds);

router.delete("/:id", adminAuth, deleteAd);

router.post("/:id/click", trackClick);

router.post("/:id/impression", trackImpression);

export default router;