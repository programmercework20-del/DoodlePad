import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { globalSearch, getRecentSearches, clearSearchHistory } from "../controllers/api/search.controller.js";

const router = express.Router();

router.get("/", protect, globalSearch);
router.get("/recent", protect, getRecentSearches);
router.delete("/recent", protect, clearSearchHistory);



export default router;
