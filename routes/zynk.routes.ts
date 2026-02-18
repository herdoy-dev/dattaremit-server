import type { RequestHandler } from "express";
import express from "express";
import rateLimit from "express-rate-limit";
import zynkController from "../controllers/zynk.controller";
import isApproved from "../middlewares/is-approved";

const plaidTokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 token generations per 15 minutes per IP
  message: {
    success: false,
    message: "Too many token generation requests. Please try again later.",
  },
});

const router = express.Router();

router.post("/entities", zynkController.createEntity as RequestHandler);
router.post("/kyc", zynkController.startKyc as RequestHandler);
router.get("/kyc/status", zynkController.getKycStatus as RequestHandler);

router.post(
  "/plaid-link-token",
  isApproved,
  plaidTokenLimiter as RequestHandler,
  zynkController.generatePlaidLinkToken as RequestHandler
);

router.post(
  "/external-account",
  isApproved,
  zynkController.addExternalAccount as RequestHandler
);

export default router;
