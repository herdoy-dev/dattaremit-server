-- CreateEnum
CREATE TYPE "address_type" AS ENUM ('PRESENT', 'PERMANENT');

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('ADMIN', 'USER', 'INFLUENCER', 'PROMOTER');

-- CreateEnum
CREATE TYPE "account_status" AS ENUM ('INITIAL', 'ACTIVE', 'PENDING', 'REJECTED');

-- CreateEnum
CREATE TYPE "idempotency_status" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "activity_status" AS ENUM ('PENDING', 'FAILED', 'COMPLETE');

-- CreateEnum
CREATE TYPE "activity_type" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'PAYMENT', 'REFUND', 'KYC_SUBMITTED', 'KYC_APPROVED', 'KYC_REJECTED', 'KYC_PENDING', 'KYC_VERIFIED', 'KYC_FAILED', 'ACCOUNT_APPROVED', 'ACCOUNT_ACTIVATED', 'ACCOUNT_DEACTIVATED');

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
    "emailHash" TEXT NOT NULL,
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

-- CreateIndex
CREATE UNIQUE INDEX "users_clerkUserId_key" ON "users"("clerkUserId");

-- CreateIndex
CREATE UNIQUE INDEX "users_emailHash_key" ON "users"("emailHash");

-- CreateIndex
CREATE UNIQUE INDEX "users_referCode_key" ON "users"("referCode");

-- CreateIndex
CREATE INDEX "addresses_userId_idx" ON "addresses"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "addresses_userId_type_key" ON "addresses"("userId", "type");

-- CreateIndex
CREATE INDEX "activities_userId_idx" ON "activities"("userId");

-- CreateIndex
CREATE INDEX "activities_type_idx" ON "activities"("type");

-- CreateIndex
CREATE INDEX "activities_status_idx" ON "activities"("status");

-- CreateIndex
CREATE INDEX "activities_referenceId_idx" ON "activities"("referenceId");

-- CreateIndex
CREATE INDEX "idempotency_keys_expiresAt_idx" ON "idempotency_keys"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_userId_operation_key_key" ON "idempotency_keys"("userId", "operation", "key");

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
