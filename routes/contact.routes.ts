import type { RequestHandler } from "express";
import express from "express";
import contactController from "../controllers/contact.controller";
import isApproved from "../middlewares/is-approved";

const router = express.Router();

router.get(
  "/",
  isApproved,
  contactController.search as RequestHandler,
);

export default router;
