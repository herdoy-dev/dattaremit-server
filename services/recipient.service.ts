import * as Sentry from "@sentry/node";
import { ActivityStatus, ActivityType, NotificationType } from "../generated/prisma/client";
import activityLogger from "../lib/activity-logger";
import notificationLogger from "../lib/notification-logger";
import AppError from "../lib/AppError";
import { encrypt, createSearchHash, decrypt, isEncrypted } from "../lib/crypto";
import recipientRepository from "../repositories/recipient.repository";
import zynkRepository from "../repositories/zynk.repository";
import type { ZynkEntityData } from "../repositories/zynk.repository";
import { sendKycEmail } from "./email.service";
import logger from "../lib/logger";
import type { CreateRecipientInput, AddRecipientBankInput } from "../schemas/recipient.schema";

function encryptRecipientData(data: Record<string, unknown>): Record<string, unknown> {
  const encrypted = { ...data };
  if (encrypted.email && typeof encrypted.email === "string" && !isEncrypted(encrypted.email)) {
    encrypted.emailHash = createSearchHash(encrypted.email as string);
    encrypted.email = encrypt(encrypted.email as string);
  }
  if (encrypted.dateOfBirth && typeof encrypted.dateOfBirth === "string" && !isEncrypted(encrypted.dateOfBirth)) {
    encrypted.dateOfBirth = encrypt(encrypted.dateOfBirth as string);
  }
  if (encrypted.phoneNumber && typeof encrypted.phoneNumber === "string" && !isEncrypted(encrypted.phoneNumber)) {
    encrypted.phoneNumber = encrypt(encrypted.phoneNumber as string);
  }
  if (encrypted.phoneNumberPrefix && typeof encrypted.phoneNumberPrefix === "string" && !isEncrypted(encrypted.phoneNumberPrefix)) {
    encrypted.phoneNumberPrefix = encrypt(encrypted.phoneNumberPrefix as string);
  }
  return encrypted;
}

function decryptRecipientData<T extends Record<string, unknown>>(recipient: T): T {
  if (!recipient) return recipient;
  const decrypted = { ...recipient } as Record<string, unknown>;
  for (const field of ["email", "dateOfBirth", "phoneNumber", "phoneNumberPrefix"]) {
    if (decrypted[field] && typeof decrypted[field] === "string" && isEncrypted(decrypted[field] as string)) {
      decrypted[field] = decrypt(decrypted[field] as string);
    }
  }
  return decrypted as T;
}

const INTERNAL_RECIPIENT_FIELDS = [
  "emailHash",
  "zynkEntityId",
  "kycLink",
] as const;

function toPublicRecipient<T extends Record<string, unknown>>(recipient: T) {
  const copy = { ...recipient } as Record<string, unknown>;
  for (const field of INTERNAL_RECIPIENT_FIELDS) {
    delete copy[field];
  }
  copy.hasBankAccount = !!copy.zynkDepositAccountId;
  delete copy.zynkDepositAccountId;
  return copy;
}

class RecipientService {
  async createRecipient(userId: string, data: CreateRecipientInput) {
    return Sentry.startSpan(
      { name: "recipient.create", op: "function" },
      async () => {
        // Check for duplicate
        const emailHash = createSearchHash(data.email);
        const existing = await recipientRepository.findByUserIdAndEmailHash(userId, emailHash);
        if (existing) {
          throw new AppError(409, "A recipient with this email already exists");
        }

        // Keep plaintext email for KYC email sending before encryption
        const plainEmail = data.email;
        const plainFirstName = data.firstName;
        const plainPhonePrefix = data.phoneNumberPrefix;
        const plainPhone = data.phoneNumber;
        const plainDob = typeof data.dateOfBirth === "object"
          ? (data.dateOfBirth as Date).toISOString()
          : String(data.dateOfBirth);

        // Create recipient record with encrypted data
        const recipientData = encryptRecipientData({
          createdByUserId: userId,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phoneNumberPrefix: data.phoneNumberPrefix,
          phoneNumber: data.phoneNumber,
          dateOfBirth: plainDob,
          nationality: "IN",
          addressLine1: data.addressLine1,
          addressLine2: data.addressLine2 || null,
          city: data.city,
          state: data.state,
          country: "IN",
          postalCode: data.postalCode,
        });

        const recipient = await recipientRepository.create(recipientData);

        // Create Zynk entity for recipient
        const entityData: ZynkEntityData = {
          email: plainEmail,
          firstName: data.firstName,
          lastName: data.lastName || " ",
          phoneNumberPrefix: plainPhonePrefix.replace("+", ""),
          phoneNumber: plainPhone,
          dateOfBirth: plainDob,
          nationality: "IN",
          permanentAddress: {
            addressLine1: data.addressLine1,
            addressLine2: data.addressLine2 || "",
            locality: data.state,
            city: data.city,
            state: data.state,
            country: "IN",
            postalCode: data.postalCode,
          },
        };

        const entityResponse = await zynkRepository.createEntity(entityData);
        const zynkEntityId = entityResponse.data.entityId;

        // Start KYC for the recipient
        const kycResponse = await zynkRepository.startKyc(zynkEntityId, "IN");

        // Update recipient with zynk data
        await recipientRepository.update(recipient.id, {
          zynkEntityId,
          kycLink: kycResponse.data.kycLink || null,
        });

        // Send KYC email to recipient
        if (kycResponse.data.kycLink) {
          const emailSent = await sendKycEmail(
            plainEmail,
            kycResponse.data.kycLink,
            plainFirstName,
          );
          if (!emailSent) {
            logger.warn(`KYC email failed to send to recipient ${recipient.id}`);
          }
        }

        await activityLogger.logActivity({
          userId,
          type: ActivityType.KYC_PENDING,
          status: ActivityStatus.PENDING,
          description: `Recipient ${data.firstName} added, KYC initiated`,
          metadata: { recipientId: recipient.id, zynkEntityId },
        });

        const decrypted = decryptRecipientData(recipient as unknown as Record<string, unknown>);
        return toPublicRecipient(decrypted);
      },
    );
  }

  async getRecipients(userId: string) {
    const recipients = await recipientRepository.findAllByUserId(userId);
    return recipients.map((r) =>
      toPublicRecipient(decryptRecipientData(r as unknown as Record<string, unknown>))
    );
  }

  async getRecipient(userId: string, recipientId: string) {
    const recipient = await recipientRepository.findById(recipientId);
    if (!recipient) {
      throw new AppError(404, "Recipient not found");
    }
    if ((recipient as any).createdByUserId !== userId) {
      throw new AppError(404, "Recipient not found");
    }
    return toPublicRecipient(decryptRecipientData(recipient as unknown as Record<string, unknown>));
  }

  async addBankAccount(userId: string, recipientId: string, data: AddRecipientBankInput) {
    return Sentry.startSpan(
      { name: "recipient.addBank", op: "http.client" },
      async () => {
        const recipient = await recipientRepository.findById(recipientId);
        if (!recipient) {
          throw new AppError(404, "Recipient not found");
        }

        const r = recipient as any;
        if (r.createdByUserId !== userId) {
          throw new AppError(404, "Recipient not found");
        }

        if (r.kycStatus !== "APPROVED") {
          throw new AppError(400, "Recipient KYC is not approved yet. Please wait for KYC approval.");
        }

        if (!r.zynkEntityId) {
          throw new AppError(400, "Recipient does not have a Zynk entity.");
        }

        if (r.zynkDepositAccountId) {
          throw new AppError(409, "Recipient already has a bank account linked.");
        }

        // Add deposit account via Zynk
        const addResponse = await zynkRepository.addDepositAccount(r.zynkEntityId, data);
        const depositAccountId = addResponse.data.accountId;

        // Enable the account
        await zynkRepository.enableExternalAccount(r.zynkEntityId, depositAccountId);

        // Update recipient
        const updated = await recipientRepository.update(recipientId, {
          zynkDepositAccountId: depositAccountId,
          bankName: data.bankName,
          bankAccountNumber: data.accountNumber,
          bankIfsc: data.ifsc,
        });

        await activityLogger.logActivity({
          userId,
          type: ActivityType.ACCOUNT_ACTIVATED,
          status: ActivityStatus.COMPLETE,
          description: `Bank account added for recipient ${r.firstName}`,
          metadata: { recipientId, depositAccountId },
        });

        notificationLogger.notify({
          userId,
          type: NotificationType.ACCOUNT_ACTIVATED,
          title: "Recipient Bank Linked",
          body: `${r.firstName}'s Indian bank account has been successfully linked. You can now send money.`,
        });

        return toPublicRecipient(decryptRecipientData(updated as unknown as Record<string, unknown>));
      },
    );
  }

  async resendKycEmail(userId: string, recipientId: string) {
    const recipient = await recipientRepository.findById(recipientId);
    if (!recipient) {
      throw new AppError(404, "Recipient not found");
    }

    const r = recipient as any;
    if (r.createdByUserId !== userId) {
      throw new AppError(404, "Recipient not found");
    }

    if (r.kycStatus === "APPROVED") {
      throw new AppError(400, "Recipient KYC is already approved.");
    }

    if (!r.zynkEntityId) {
      throw new AppError(400, "Recipient does not have a Zynk entity.");
    }

    // Re-start KYC to get a fresh link
    const kycResponse = await zynkRepository.startKyc(r.zynkEntityId, "IN");

    if (kycResponse.data.kycLink) {
      await recipientRepository.update(recipientId, {
        kycLink: kycResponse.data.kycLink,
      });

      const decrypted = decryptRecipientData(r as Record<string, unknown>);
      const emailSent = await sendKycEmail(
        decrypted.email as string,
        kycResponse.data.kycLink,
        r.firstName,
      );

      if (!emailSent) {
        throw new AppError(500, "Failed to send KYC email. Please try again.");
      }
    }
  }
}

export default new RecipientService();
