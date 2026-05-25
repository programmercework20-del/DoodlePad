import express from "express";

import { protect } from "../middlewares/auth.middleware.js";

import {
  getExploreFeed
} from "../controllers/api/explore.controller.js";

const router = express.Router();

router.get("/", protect, getExploreFeed);

export default router;