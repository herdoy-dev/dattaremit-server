-- CreateEnum
CREATE TYPE "recipient_kyc_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FAILED');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "recipientId" UUID,
ALTER COLUMN "receiverId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "recipients" (
    "id" UUID NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailHash" TEXT NOT NULL,
    "phoneNumberPrefix" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "dateOfBirth" TEXT NOT NULL,
    "nationality" TEXT NOT NULL DEFAULT 'IN',
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'IN',
    "postalCode" TEXT NOT NULL,
    "zynkEntityId" TEXT,
    "zynkDepositAccountId" TEXT,
    "kycStatus" "recipient_kyc_status" NOT NULL DEFAULT 'PENDING',
    "kycLink" TEXT,
    "bankName" TEXT,
    "bankAccountNumber" TEXT,
    "bankIfsc" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recipients_createdByUserId_idx" ON "recipients"("createdByUserId");

-- CreateIndex
CREATE INDEX "recipients_zynkEntityId_idx" ON "recipients"("zynkEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "recipients_createdByUserId_emailHash_key" ON "recipients"("createdByUserId", "emailHash");

-- CreateIndex
CREATE INDEX "transactions_recipientId_idx" ON "transactions"("recipientId");

-- AddForeignKey
ALTER TABLE "recipients" ADD CONSTRAINT "recipients_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "recipients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
