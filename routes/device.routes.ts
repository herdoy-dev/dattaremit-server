import type { RequestHandler } from "express";
import express from "express";
import deviceController from "../controllers/device.controller";
import dbUser from "../middlewares/db-user";
import { sensitiveRateLimit } from "../middlewares/strict-rate-limit";

const router = express.Router();

router.post(
  "/register",
  dbUser,
  sensitiveRateLimit,
  deviceController.register as RequestHandler
);
router.delete(
  "/:id",
  dbUser,
  deviceController.unregister as RequestHandler
);

export default router;
