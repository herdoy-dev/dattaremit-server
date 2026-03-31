import * as Sentry from "@sentry/node";
import {
  ActivityStatus,
  ActivityType,
  NotificationType,
} from "../generated/prisma/client";
import activityLogger from "../lib/activity-logger";
import notificationLogger from "../lib/notification-logger";
import AppError from "../lib/AppError";
import prismaClient from "../lib/prisma-client";
import zynkRepository from "../repositories/zynk.repository";

interface RecipientRecord {
  id: string;
  firstName: string;
  lastName: string;
  zynkEntityId: string | null;
  zynkDepositAccountId: string | null;
  createdByUserId: string;
}

class TransferService {
  async sendMoneyToRecipient(
    senderId: string,
    recipient: RecipientRecord,
    amount: number,
    note?: string,
  ) {
    return Sentry.startSpan(
      {
        name: "transfer.sendMoneyToRecipient",
        op: "http.client",
        attributes: { "transfer.amount": amount },
      },
      async () => {
        // Validate sender (US user with Plaid-linked account)
        const sender = await prismaClient.user.findUnique({
          where: { id: senderId },
        });
        if (!sender) {
          throw new AppError(404, "Sender not found");
        }
        if (!sender.zynkEntityId || !sender.zynkExternalAccountId) {
          throw new AppError(
            400,
            "Sender does not have a linked bank account. Please connect your bank account first.",
          );
        }

        // Validate recipient
        if (!recipient.zynkEntityId || !recipient.zynkDepositAccountId) {
          throw new AppError(
            400,
            "Recipient does not have a linked bank account.",
          );
        }

        // Generate unique transaction ID
        const zynkTransactionId = `txn_${crypto.randomUUID().replace(/-/g, "")}`;

        // Step 1: Simulate transaction
        const simulateResponse = await zynkRepository.simulateTransaction({
          transactionId: zynkTransactionId,
          fromEntityId: sender.zynkEntityId,
          fromAccountId: sender.zynkExternalAccountId,
          toEntityId: recipient.zynkEntityId,
          toAccountId: recipient.zynkDepositAccountId,
          exactAmountIn: amount,
          depositMemo: note,
        });

        const { executionId, quote } = simulateResponse.data;

        // Save transaction with SIMULATED status (recipientId instead of receiverId)
        const transaction = await prismaClient.transaction.create({
          data: {
            senderId,
            recipientId: recipient.id,
            zynkTransactionId,
            zynkExecutionId: executionId,
            sendAmount: amount,
            sendCurrency: quote.inAmount.currency,
            receiveAmount: quote.outAmount.amount,
            receiveCurrency: quote.outAmount.currency,
            exchangeRate: quote.exchangeRate.rate,
            totalFees: quote.fees.totalFees.amount,
            feeCurrency: quote.fees.totalFees.currency,
            status: "SIMULATED",
            depositMemo: note,
            simulateResponse: simulateResponse.data as object,
          },
        });

        // Step 2: Execute transfer
        try {
          const transferResponse = await zynkRepository.executeTransfer({
            executionId,
            transferAcknowledgement: "ACCEPTED",
          });

          // Update transaction to ACCEPTED
          await prismaClient.transaction.update({
            where: { id: transaction.id },
            data: {
              status: "ACCEPTED",
              transferResponse: transferResponse.data as object,
            },
          });

          // Log activity for sender
          activityLogger.logActivity({
            userId: senderId,
            type: ActivityType.TRANSFER,
            status: ActivityStatus.COMPLETE,
            description: `Sent $${amount} to ${recipient.firstName}`,
            amount: amount,
            referenceId: transaction.id,
            metadata: {
              zynkTransactionId,
              executionId,
              recipientId: recipient.id,
              recipientName: recipient.firstName,
            },
          });

          // Notify sender
          notificationLogger.notify({
            userId: senderId,
            type: NotificationType.TRANSACTION_INITIATED,
            title: "Money Sent",
            body: `$${amount} has been sent to ${recipient.firstName}. The recipient will receive ${quote.outAmount.currency} ${quote.outAmount.amount}.`,
          });

          Sentry.addBreadcrumb({
            category: "transfer",
            message: "Transfer executed successfully",
            level: "info",
            data: { zynkTransactionId, executionId },
          });

          return {
            transactionId: transaction.id,
            zynkTransactionId,
            status: "ACCEPTED",
            quote: {
              sendAmount: quote.inAmount,
              receiveAmount: quote.outAmount,
              exchangeRate: quote.exchangeRate,
              fees: quote.fees.totalFees,
            },
          };
        } catch (error) {
          // Transfer failed after simulate succeeded — mark as FAILED
          await prismaClient.transaction.update({
            where: { id: transaction.id },
            data: {
              status: "FAILED",
              failureReason:
                error instanceof Error ? error.message : "Transfer execution failed",
            },
          });

          activityLogger.logActivity({
            userId: senderId,
            type: ActivityType.TRANSFER,
            status: ActivityStatus.FAILED,
            description: `Transfer of $${amount} failed`,
            amount: amount,
            referenceId: transaction.id,
            metadata: { zynkTransactionId, executionId },
          });

          notificationLogger.notify({
            userId: senderId,
            type: NotificationType.TRANSACTION_FAILED,
            title: "Transfer Failed",
            body: `Your transfer of $${amount} could not be completed. Please try again.`,
          });

          throw error;
        }
      },
    );
  }
}

export default new TransferService();
