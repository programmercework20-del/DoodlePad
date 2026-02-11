import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { globalSearch } from "../controllers/api/search.controller.js";

const router = express.Router();

router.get("/", protect, globalSearch);

export default router;
