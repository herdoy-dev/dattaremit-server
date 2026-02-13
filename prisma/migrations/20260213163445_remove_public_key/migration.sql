/*
  Warnings:

  - Added the required column `walletAddress` to the `external_accounts` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "external_accounts" ADD COLUMN     "walletAddress" TEXT NOT NULL,
ADD COLUMN     "walletId" TEXT;

-- CreateTable
CREATE TABLE "key_backups" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "key_backups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "key_backups_userId_key" ON "key_backups"("userId");
