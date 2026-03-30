import type { Response } from "express";
import Joi from "joi";
import APIResponse from "../lib/APIResponse";
import asyncHandler from "../lib/async-handler";
import validate from "../lib/validate";
import type { AuthRequest } from "../middlewares/auth";
import contactService from "../services/contact.service";

const searchSchema = Joi.object({
  q: Joi.string().trim().max(100).default(""),
});

class ContactController {
  search = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { q } = validate(searchSchema, req.query);
    const results = await contactService.search(q, req.user.id);
    res
      .status(200)
      .json(new APIResponse(true, "Contacts retrieved successfully", results));
  });
}

export default new ContactController();
