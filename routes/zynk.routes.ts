import type { RequestHandler } from "express";
import express from "express";
import zynkController from "../controllers/zynk.controller";
import isApproved from "../middlewares/is-approved";

const router = express.Router();

router.post("/entities", zynkController.createEntity as RequestHandler);
router.post("/kyc", zynkController.startKyc as RequestHandler);
router.get("/kyc/status", zynkController.getKycStatus as RequestHandler);
router.post(
  "/funding-account",
  isApproved,
  zynkController.createFundingAccount as RequestHandler
);
router.get(
  "/funding-account",
  isApproved,
  zynkController.getFundingAccount as RequestHandler
);
router.post(
  "/funding-account/activate",
  isApproved,
  zynkController.activateFundingAccount as RequestHandler
);
router.post(
  "/funding-account/deactivate",
  isApproved,
  zynkController.deactivateFundingAccount as RequestHandler
);

export default router;
