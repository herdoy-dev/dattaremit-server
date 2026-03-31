import type { RequestHandler } from "express";
import express from "express";
import recipientController from "../controllers/recipient.controller";
import { sensitiveRateLimit } from "../middlewares/strict-rate-limit";

const router = express.Router();

router.post(
  "/",
  sensitiveRateLimit as RequestHandler,
  recipientController.create as RequestHandler,
);

router.get("/", recipientController.list as RequestHandler);

router.get("/:id", recipientController.getOne as RequestHandler);

router.post(
  "/:id/bank",
  sensitiveRateLimit as RequestHandler,
  recipientController.addBank as RequestHandler,
);

router.post(
  "/:id/resend-kyc",
  recipientController.resendKyc as RequestHandler,
);

export default router;
