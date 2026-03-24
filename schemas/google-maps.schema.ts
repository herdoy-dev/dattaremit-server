import Joi from "joi";

// --- Joi Schemas ---

export const autocompleteQuerySchema = Joi.object({
  input: Joi.string().trim().min(3).max(500).required().messages({
    "string.empty": "Search input cannot be empty",
    "string.min": "Search input must be at least 3 characters",
    "string.max": "Search input cannot exceed 500 characters",
    "any.required": "Search input is required",
  }),

  country: Joi.string().trim().valid("US", "IN").optional().messages({
    "any.only": "Country must be US or IN",
  }),

  sessionToken: Joi.string()
    .trim()
    .guid({ version: ["uuidv4"] })
    .optional()
    .messages({
      "string.guid": "Session token must be a valid UUID v4",
    }),

  city: Joi.string().trim().max(100).optional().messages({
    "string.max": "City cannot exceed 100 characters",
  }),

  state: Joi.string().trim().max(100).optional().messages({
    "string.max": "State cannot exceed 100 characters",
  }),

  types: Joi.string()
    .trim()
    .valid("address", "(cities)", "(regions)")
    .optional()
    .messages({
      "any.only": "Types must be one of: address, (cities), (regions)",
    }),
});

export const placeDetailsQuerySchema = Joi.object({
  placeId: Joi.string().trim().min(1).max(300).required().messages({
    "string.empty": "Place ID cannot be empty",
    "string.max": "Place ID cannot exceed 300 characters",
    "any.required": "Place ID is required",
  }),

  sessionToken: Joi.string()
    .trim()
    .guid({ version: ["uuidv4"] })
    .optional()
    .messages({
      "string.guid": "Session token must be a valid UUID v4",
    }),
});

export const validateAddressBodySchema = Joi.object({
  addressLine1: Joi.string().trim().min(1).max(255).required().messages({
    "string.empty": "Address line 1 cannot be empty",
    "string.max": "Address line 1 cannot exceed 255 characters",
    "any.required": "Address line 1 is required",
  }),

  addressLine2: Joi.string().trim().max(255).allow("").optional().messages({
    "string.max": "Address line 2 cannot exceed 255 characters",
  }),

  city: Joi.string().trim().min(1).max(100).required().messages({
    "string.empty": "City cannot be empty",
    "string.max": "City cannot exceed 100 characters",
    "any.required": "City is required",
  }),

  state: Joi.string().trim().min(1).max(100).required().messages({
    "string.empty": "State cannot be empty",
    "string.max": "State cannot exceed 100 characters",
    "any.required": "State is required",
  }),

  country: Joi.string().trim().valid("US", "IN").required().messages({
    "string.empty": "Country cannot be empty",
    "any.only": "Country must be US or IN",
    "any.required": "Country is required",
  }),

  postalCode: Joi.string().trim().min(1).max(20).required().messages({
    "string.empty": "Postal code cannot be empty",
    "string.max": "Postal code cannot exceed 20 characters",
    "any.required": "Postal code is required",
  }),
});

// --- TypeScript Types ---

export type ValidationStatus =
  | "VALID"
  | "NEEDS_REVIEW"
  | "INVALID"
  | "UNAVAILABLE";

export type AddressValidationResult = {
  validationStatus: ValidationStatus;
  validationGranularity?: string;
  addressComplete?: boolean;
  formattedAddress?: string;
  corrections?: Array<{
    field: string;
    original: string;
    corrected: string;
  }>;
};

export type AutocompletePrediction = {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
};

export type AutocompleteQuery = {
  input: string;
  country?: "US" | "IN";
  sessionToken?: string;
  city?: string;
  state?: string;
  types?: "address" | "(cities)" | "(regions)";
};

export type PlaceDetailsQuery = {
  placeId: string;
  sessionToken?: string;
};

export type AddressComponents = {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  formattedAddress: string;
};

export type ValidateAddressBody = {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  country: "US" | "IN";
  postalCode: string;
};
