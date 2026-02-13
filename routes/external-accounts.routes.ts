import type { RequestHandler } from "express";
import express from "express";
import externalAccountsController from "../controllers/external-accounts.controller";

const router = express.Router();

router.post(
  "/",

  externalAccountsController.create as RequestHandler
);
router.get(
  "/",

  externalAccountsController.list as RequestHandler
);
router.get(
  "/:id",

  externalAccountsController.getById as RequestHandler
);
router.delete(
  "/:id",

  externalAccountsController.delete as RequestHandler
);

export default router;
