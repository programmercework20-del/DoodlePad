import express from "express";
import userAuth from "../middlewares/userAuth.js";
import {
  addCloseFriend,
  removeCloseFriend,
  getMyCloseFriends
} from "../controllers/api/closeFriend.controller.js";

const router = express.Router();

router.post("/add", userAuth, addCloseFriend);
router.delete("/remove", userAuth, removeCloseFriend);
router.get("/", userAuth, getMyCloseFriends);

export default router;
