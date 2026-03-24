import type { RequestHandler } from "express";
import express from "express";
import exchangeRateController from "../controllers/exchange-rate.controller";
import { publicApiRateLimit } from "../middlewares/strict-rate-limit";

const router = express.Router();

router.get("/exchange-rate", publicApiRateLimit, exchangeRateController.getRate as RequestHandler);

export default router;
