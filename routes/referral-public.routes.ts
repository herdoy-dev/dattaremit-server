import type { RequestHandler } from "express";
import express from "express";
import referralController from "../controllers/referral.controller";

const router = express.Router();

router.get(
  "/referral/tracker/:referCode",
  referralController.getTrackerStats as RequestHandler
);

export default router;
