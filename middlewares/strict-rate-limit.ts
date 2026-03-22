import rateLimit from "express-rate-limit";

export const adminRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    success: false,
    message: "Too many admin requests. Please try again later.",
  },
});

export const publicApiRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});

export const sensitiveRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10,
  message: {
    success: false,
    message: "Too many requests to this endpoint. Please slow down.",
  },
});
