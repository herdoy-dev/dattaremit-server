import crypto from "node:crypto";

// AES-256-GCM Encryption Configuration
const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

/**
 * Get encryption key from environment variable
 * Key must be 32 bytes (256 bits) hex-encoded (64 characters)
 */
const getEncryptionKey = (): Buffer => {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable is not set");
  }
  if (key.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY must be 64 hex characters (32 bytes / 256 bits)"
    );
  }
  return Buffer.from(key, "hex");
};

/**
 * Encrypt a string using AES-256-GCM
 * Returns format: iv:authTag:encryptedData (all base64 encoded)
 */
export const encrypt = (plainText: string): string => {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  let encrypted = cipher.update(plainText, "utf8", "base64");
  encrypted += cipher.final("base64");

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encryptedData
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted}`;
};

/**
 * Decrypt a string encrypted with AES-256-GCM
 * Expects format: iv:authTag:encryptedData (all base64 encoded)
 */
export const decrypt = (encryptedText: string): string => {
  const key = getEncryptionKey();

  const parts = encryptedText.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted text format");
  }

  const ivBase64 = parts[0]!;
  const authTagBase64 = parts[1]!;
  const encryptedData = parts[2]!;

  const iv = Buffer.from(ivBase64, "base64");
  const authTag = Buffer.from(authTagBase64, "base64");

  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const decrypted =
    decipher.update(encryptedData, "base64", "utf8") + decipher.final("utf8");

  return decrypted;
};

/**
 * Check if a string is encrypted (has the expected format)
 * Format: iv:authTag:encryptedData (base64 encoded)
 * - IV must be exactly 16 bytes
 * - AuthTag must be exactly 16 bytes
 */
export const isEncrypted = (text: string): boolean => {
  if (!text || typeof text !== "string") return false;
  const parts = text.split(":");
  if (parts.length !== 3) return false;

  try {
    const iv = Buffer.from(parts[0]!, "base64");
    const authTag = Buffer.from(parts[1]!, "base64");
    Buffer.from(parts[2]!, "base64");

    // IV must be 16 bytes, authTag must be 16 bytes
    // This prevents false positives from ISO dates like "2001-01-14T00:00:00.000Z"
    return iv.length === 16 && authTag.length === 16;
  } catch {
    return false;
  }
};

/**
 * Create a deterministic hash of a value for lookups (e.g., email)
 * Uses HMAC-SHA256 with the encryption key for added security
 */
export const createSearchHash = (value: string): string => {
  const key = getEncryptionKey();
  const normalizedValue = value.toLowerCase().trim();
  return crypto.createHmac("sha256", key).update(normalizedValue).digest("hex");
};

export const sha256 = async (input: string): Promise<string> => {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

