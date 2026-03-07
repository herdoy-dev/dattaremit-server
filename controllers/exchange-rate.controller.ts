import type { Request, Response } from "express";
import APIResponse from "../lib/APIResponse";
import asyncHandler from "../lib/async-handler";
import exchangeRateService from "../services/exchange-rate.service";

class ExchangeRateController {
  getRate = asyncHandler(async (_req: Request, res: Response) => {
    const result = await exchangeRateService.getRate();
    res
      .status(200)
      .json(new APIResponse(true, "Exchange rate retrieved successfully", result));
  });
}

export default new ExchangeRateController();
