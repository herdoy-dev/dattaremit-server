import type { Response } from "express";
import APIResponse from "../lib/APIResponse";
import asyncHandler from "../lib/async-handler";
import validate from "../lib/validate";
import type { AuthRequest } from "../middlewares/auth";
import {
  autocompleteQuerySchema,
  placeDetailsQuerySchema,
  validateAddressBodySchema,
} from "../schemas/google-maps.schema";
import googleMapsService from "../services/google-maps.service";

class GoogleMapsController {
  autocomplete = asyncHandler(async (req: AuthRequest, res: Response) => {
    const value = validate(autocompleteQuerySchema, req.query);

    const predictions = await googleMapsService.getAutocompleteSuggestions(
      value.input,
      value.country,
      value.sessionToken,
      value.city,
      value.state,
      value.types
    );

    res
      .status(200)
      .json(
        new APIResponse(true, "Address suggestions retrieved", predictions)
      );
  });

  placeDetails = asyncHandler(async (req: AuthRequest, res: Response) => {
    const value = validate(placeDetailsQuerySchema, req.query);

    const components = await googleMapsService.getPlaceDetails(
      value.placeId,
      value.sessionToken
    );

    res
      .status(200)
      .json(
        new APIResponse(true, "Place details retrieved", components)
      );
  });

  validateAddress = asyncHandler(async (req: AuthRequest, res: Response) => {
    const value = validate(validateAddressBodySchema, req.body);

    const result = await googleMapsService.validateAddress(value);

    res
      .status(200)
      .json(new APIResponse(true, "Address validated", result));
  });
}

export default new GoogleMapsController();
