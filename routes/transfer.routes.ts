import type { RequestHandler } from "express";
import express from "express";
import transferController from "../controllers/transfer.controller";

const router = express.Router();

router.post("/simulate", transferController.simulateTransfer as RequestHandler);
router.post("/transfer", transferController.transfer as RequestHandler);

export default router;
