import type { RequestHandler } from "express";
import express from "express";
import addressController from "../controllers/address.controller";
import dbUser from "../middlewares/db-user";

const router = express.Router();

router.get("/", dbUser, addressController.getAllByUserId as RequestHandler);
router.get("/:id", dbUser, addressController.getById as RequestHandler);
router.post("/", dbUser, addressController.create as RequestHandler);
router.put("/:id", dbUser, addressController.update as RequestHandler);
router.delete("/:id", dbUser, addressController.delete as RequestHandler);

export default router;
