import type { Response } from "express";
import APIResponse from "../lib/APIResponse";
import asyncHandler from "../lib/async-handler";
import type { AuthRequest } from "../middlewares/auth";
import contactService from "../services/contact.service";

class ContactController {
  search = asyncHandler(async (req: AuthRequest, res: Response) => {
    const query = (req.query.q as string) || "";
    const results = await contactService.search(query, req.user.id);
    res
      .status(200)
      .json(new APIResponse(true, "Contacts retrieved successfully", results));
  });
}

export default new ContactController();
