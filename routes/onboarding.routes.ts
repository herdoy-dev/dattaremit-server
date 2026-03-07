import type { RequestHandler } from "express";
import express from "express";
import onboardingController from "../controllers/onboarding.controller";
import dbUser from "../middlewares/db-user";
import hasAddress from "../middlewares/has-address";
import { sensitiveRateLimit } from "../middlewares/strict-rate-limit";

const router = express.Router();

router.post("/address", dbUser, onboardingController.submitAddress as RequestHandler);
router.post("/kyc", sensitiveRateLimit as RequestHandler, dbUser, hasAddress, onboardingController.requestKyc as RequestHandler);

export default router;
