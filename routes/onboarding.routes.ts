import type { RequestHandler } from "express";
import express from "express";
import onboardingController from "../controllers/onboarding.controller";
import dbUser from "../middlewares/db-user";

const router = express.Router();

router.post("/address", dbUser, onboardingController.submitAddress as RequestHandler);
router.post("/kyc", dbUser, onboardingController.requestKyc as RequestHandler);

export default router;
