import type { RequestHandler } from "express";
import express from "express";
import referralController from "../controllers/referral.controller";
import { sensitiveRateLimit } from "../middlewares/strict-rate-limit";

const router = express.Router();

router.get(
  "/referral/tracker/:referCode",
  sensitiveRateLimit as RequestHandler,
  referralController.getTrackerStats as RequestHandler
);

export default router;
