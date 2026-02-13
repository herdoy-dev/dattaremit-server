import type { Request, Response, NextFunction } from "express";
import APIResponse from "../lib/APIResponse";
import AppError from "../lib/AppError";
import { createContactSchema } from "../schemas/contact.schema";
import contactService from "../services/contact.service";

class ContactController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { error, value } = createContactSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        throw new AppError(400, error.details.map((d) => d.message).join(", "));
      }

      const contact = await contactService.create(value);
      res
        .status(201)
        .json(new APIResponse(true, "Contact submitted successfully", contact));
    } catch (error) {
      next(error);
    }
  }
}

export default new ContactController();
