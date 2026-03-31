-- CreateEnum
CREATE TYPE "address_type" AS ENUM ('PRESENT', 'PERMANENT');

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('ADMIN', 'USER', 'INFLUENCER', 'PROMOTER');

-- CreateEnum
CREATE TYPE "account_status" AS ENUM ('INITIAL', 'ACTIVE', 'PENDING', 'REJECTED', 'DELETED');

-- CreateEnum
CREATE TYPE "recipient_kyc_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "idempotency_status" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "activity_status" AS ENUM ('PENDING', 'FAILED', 'COMPLETE');

-- CreateEnum
CREATE TYPE "activity_type" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'PAYMENT', 'REFUND', 'KYC_SUBMITTED', 'KYC_APPROVED', 'KYC_REJECTED', 'KYC_PENDING', 'KYC_VERIFIED', 'KYC_FAILED', 'ACCOUNT_APPROVED', 'ACCOUNT_ACTIVATED', 'ACCOUNT_DEACTIVATED', 'ADMIN_ACTION');

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('KYC_APPROVED', 'KYC_REJECTED', 'KYC_FAILED', 'KYC_PENDING', 'ACCOUNT_ACTIVATED', 'TRANSACTION_INITIATED', 'TRANSACTION_COMPLETED', 'TRANSACTION_FAILED', 'PROMOTIONAL', 'SYSTEM_ALERT', 'REFERRAL_BONUS', 'PROFILE_UPDATED', 'PASSWORD_CHANGED');

-- CreateEnum
CREATE TYPE "device_platform" AS ENUM ('IOS', 'ANDROID');

-- CreateEnum
CREATE TYPE "transaction_status" AS ENUM ('SIMULATED', 'ACCEPTED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "firstName" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "zynkEntityId" TEXT,
    "zynkExternalAccountId" TEXT,
    "zynkDepositAccountId" TEXT,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneNumberPrefix" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "dateOfBirth" TEXT NOT NULL,
    "nationality" TEXT,
    "referCode" TEXT,
    "referredByCode" TEXT,
    "referValue" INTEGER NOT NULL DEFAULT 1,
    "role" "user_role" NOT NULL DEFAULT 'USER',
    "accountStatus" "account_status" NOT NULL DEFAULT 'INITIAL',
    "achPushEnabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" UUID NOT NULL,
    "type" "address_type" NOT NULL DEFAULT 'PRESENT',
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "userId" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipients" (
    "id" UUID NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "activities" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "activity_type" NOT NULL,
    "status" "activity_status" NOT NULL DEFAULT 'PENDING',
    "description" TEXT,
    "amount" DECIMAL(18,6),
    "metadata" JSONB,
    "referenceId" UUID,
    "ipAddress" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "operation" TEXT NOT NULL,
    "status" "idempotency_status" NOT NULL DEFAULT 'PENDING',
    "requestHash" TEXT,
    "responseStatus" INTEGER,
    "responseBody" JSONB,
    "errorMessage" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "notification_type" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "body" VARCHAR(1000) NOT NULL,
    "metadata" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_devices" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "platform" "device_platform" NOT NULL,
    "expoPushToken" TEXT NOT NULL,
    "deviceName" VARCHAR(255),
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "receiverId" UUID,
    "recipientId" UUID,
    "zynkTransactionId" TEXT NOT NULL,
    "zynkExecutionId" TEXT,
    "sendAmount" DECIMAL(18,6) NOT NULL,
    "sendCurrency" TEXT NOT NULL DEFAULT 'USD',
    "receiveAmount" DECIMAL(18,6),
    "receiveCurrency" TEXT NOT NULL DEFAULT 'INR',
    "exchangeRate" DECIMAL(18,6),
    "totalFees" DECIMAL(18,6),
    "feeCurrency" TEXT DEFAULT 'USD',
    "status" "transaction_status" NOT NULL DEFAULT 'SIMULATED',
    "depositMemo" TEXT,
    "simulateResponse" JSONB,
    "transferResponse" JSONB,
    "failureReason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_clerkUserId_key" ON "users"("clerkUserId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_referCode_key" ON "users"("referCode");

-- CreateIndex
CREATE INDEX "users_referredByCode_idx" ON "users"("referredByCode");

-- CreateIndex
CREATE INDEX "users_zynkEntityId_idx" ON "users"("zynkEntityId");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- CreateIndex
CREATE INDEX "addresses_userId_idx" ON "addresses"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "addresses_userId_type_key" ON "addresses"("userId", "type");

-- CreateIndex
CREATE INDEX "recipients_createdByUserId_idx" ON "recipients"("createdByUserId");

-- CreateIndex
CREATE INDEX "recipients_zynkEntityId_idx" ON "recipients"("zynkEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "recipients_createdByUserId_email_key" ON "recipients"("createdByUserId", "email");

-- CreateIndex
CREATE INDEX "activities_userId_idx" ON "activities"("userId");

-- CreateIndex
CREATE INDEX "activities_type_idx" ON "activities"("type");

-- CreateIndex
CREATE INDEX "activities_status_idx" ON "activities"("status");

-- CreateIndex
CREATE INDEX "activities_referenceId_idx" ON "activities"("referenceId");

-- CreateIndex
CREATE INDEX "activities_created_at_idx" ON "activities"("created_at");

-- CreateIndex
CREATE INDEX "idempotency_keys_expiresAt_idx" ON "idempotency_keys"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_userId_operation_key_key" ON "idempotency_keys"("userId", "operation", "key");

-- CreateIndex
CREATE INDEX "notifications_userId_created_at_idx" ON "notifications"("userId", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE UNIQUE INDEX "user_devices_expoPushToken_key" ON "user_devices"("expoPushToken");

-- CreateIndex
CREATE INDEX "user_devices_userId_idx" ON "user_devices"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_zynkTransactionId_key" ON "transactions"("zynkTransactionId");

-- CreateIndex
CREATE INDEX "transactions_senderId_idx" ON "transactions"("senderId");

-- CreateIndex
CREATE INDEX "transactions_receiverId_idx" ON "transactions"("receiverId");

-- CreateIndex
CREATE INDEX "transactions_recipientId_idx" ON "transactions"("recipientId");

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");

-- CreateIndex
CREATE INDEX "transactions_created_at_idx" ON "transactions"("created_at");

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipients" ADD CONSTRAINT "recipients_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "recipients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
