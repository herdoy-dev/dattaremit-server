import type { RequestHandler } from "express";
import express from "express";
import exchangeRateController from "../controllers/exchange-rate.controller";

const router = express.Router();

router.get("/exchange-rate", exchangeRateController.getRate as RequestHandler);

export default router;
