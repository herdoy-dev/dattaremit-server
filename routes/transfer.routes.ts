import type { RequestHandler } from "express";
import express from "express";
import transferController from "../controllers/transfer.controller";
import isApproved from "../middlewares/is-approved";
import { sensitiveRateLimit } from "../middlewares/strict-rate-limit";

const router = express.Router();

router.get(
  "/receive-info",
  transferController.getReceiveInfo as RequestHandler,
);

router.post(
  "/send",
  isApproved,
  sensitiveRateLimit as RequestHandler,
  transferController.send as RequestHandler,
);

export default router;
