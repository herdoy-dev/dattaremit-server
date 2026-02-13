import Joi from "joi";
import { isAddress } from "ethers";
import { PublicKey } from "@solana/web3.js";

// ============================================
// Create External Account Schema
// ============================================

// Ethereum address pattern: 0x followed by 40 hex characters

const validateEthereumAddress = (address: string) => {
  return isAddress(address);
};

const validateSolanaAddress = (address: string) => {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
};

export const createExternalAccountSchema = Joi.object({
  chain: Joi.string().valid("ethereum", "solana").messages({
    "any.only": "Chain must be either 'ethereum' or 'solana'",
    "string.empty": "Chain cannot be empty",
  }),

  walletAddress: Joi.string()
    .required()
    .custom((value, helpers) => {
      const { chain } = helpers.state.ancestors[0];

      if (chain === "solana") {
        if (!validateSolanaAddress(value)) {
          return helpers.error("any.invalid.solana");
        }
      } else if (!validateEthereumAddress(value)) {
        // Default to Ethereum validation when chain is not specified or is 'ethereum'
        return helpers.error("any.invalid.ethereum");
      }

      return value;
    })
    .messages({
      "string.empty": "Wallet address cannot be empty",
      "any.invalid.ethereum": "Please provide a valid Ethereum address",
      "any.invalid.solana": "Please provide a valid Solana address",
      "any.required": "Wallet address is required",
    }),

  label: Joi.string().min(1).max(100).optional().messages({
    "string.empty": "Label cannot be empty",
    "string.max": "Label cannot exceed 100 characters",
  }),

  type: Joi.string().optional().messages({
    "string.empty": "Type cannot be empty",
  }),

  walletId: Joi.string().optional().messages({
    "string.empty": "Wallet ID cannot be empty",
  }),
});

// ============================================
// ID Parameter Schema
// ============================================

export const externalAccountIdSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.base": "ID must be a string",
    "string.guid": "ID must be a valid UUID",
    "any.required": "ID is required",
  }),
});

// ============================================
// Type Exports
// ============================================

export type CreateExternalAccountInput = {
  walletAddress: string;
  label?: string;
  type?: string;
  walletId?: string;
};

export type ExternalAccountIdParam = {
  id: string;
};
