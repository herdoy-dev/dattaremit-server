import type { RequestHandler } from "express";
import express from "express";
import rateLimit from "express-rate-limit";
import googleMapsController from "../controllers/google-maps.controller";

const router = express.Router();

const autocompleteRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30,
  message: {
    success: false,
    message: "Too many autocomplete requests. Please slow down.",
  },
});

const validateRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10,
  message: {
    success: false,
    message: "Too many validation requests. Please slow down.",
  },
});

const placeDetailsRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30,
  message: {
    success: false,
    message: "Too many place detail requests. Please slow down.",
  },
});

router.get(
  "/autocomplete",
  autocompleteRateLimit,
  googleMapsController.autocomplete as RequestHandler
);

router.get(
  "/place-details",
  placeDetailsRateLimit,
  googleMapsController.placeDetails as RequestHandler
);

router.post(
  "/validate-address",
  validateRateLimit,
  googleMapsController.validateAddress as RequestHandler
);

export default router;
