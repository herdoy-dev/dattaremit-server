import type { Request, Response, NextFunction } from "express";
import APIResponse from "../lib/APIResponse";
import exchangeRateService from "../services/exchange-rate.service";

class ExchangeRateController {
  async getRate(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await exchangeRateService.getRate();
      res
        .status(200)
        .json(new APIResponse(true, "Exchange rate retrieved successfully", result));
    } catch (error) {
      next(error);
    }
  }
}

export default new ExchangeRateController();
