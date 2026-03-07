import type Joi from "joi";
import AppError from "./AppError";

export default function validate<T>(
  schema: Joi.ObjectSchema<T>,
  data: unknown,
  options?: Joi.ValidationOptions
): T {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
    ...options,
  });

  if (error) {
    throw new AppError(400, error.details.map((d) => d.message).join(", "));
  }

  return value;
}
