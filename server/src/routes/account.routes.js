import express from "express";
import { protect } from "../middlewares/auth.middleware.js";

import {
  deactivateAccount,
  reactivateAccount
} from "../controllers/api/account.controller.js";

const router = express.Router();

router.patch(
  "/deactivate",
  protect,
  deactivateAccount
);

router.patch(
  "/reactivate",
  reactivateAccount
);

export default router;