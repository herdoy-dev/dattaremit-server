import type { RequestHandler } from "express";
import express from "express";
import referralController from "../controllers/referral.controller";
import dbUser from "../middlewares/db-user";
import { sensitiveRateLimit } from "../middlewares/strict-rate-limit";

const router = express.Router();

router.post("/validate", sensitiveRateLimit as RequestHandler, referralController.validateReferCode as RequestHandler);
router.post("/request-code", dbUser, referralController.requestReferCode as RequestHandler);

export default router;
