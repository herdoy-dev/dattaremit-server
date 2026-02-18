-- DropForeignKey
ALTER TABLE "teleports" DROP CONSTRAINT IF EXISTS "teleports_externalAccountId_fkey";
ALTER TABLE "teleports" DROP CONSTRAINT IF EXISTS "teleports_userId_fkey";
ALTER TABLE "external_accounts" DROP CONSTRAINT IF EXISTS "external_accounts_userId_fkey";

-- DropTable
DROP TABLE IF EXISTS "teleports";
DROP TABLE IF EXISTS "external_accounts";
DROP TABLE IF EXISTS "key_backups";

-- DropEnum
DROP TYPE IF EXISTS "external_account_status";
DROP TYPE IF EXISTS "teleport_status";

-- Remove wallet-related enum values from activity_type
-- First update any existing rows that use these values
UPDATE "activities" SET "type" = 'DEPOSIT' WHERE "type" = 'EXTERNAL_ACCOUNT_ADDED';
UPDATE "activities" SET "type" = 'WITHDRAWAL' WHERE "type" = 'EXTERNAL_ACCOUNT_REMOVED';

-- Create new enum type without the removed values
CREATE TYPE "activity_type_new" AS ENUM (
  'DEPOSIT',
  'WITHDRAWAL',
  'TRANSFER',
  'PAYMENT',
  'REFUND',
  'KYC_SUBMITTED',
  'KYC_APPROVED',
  'KYC_REJECTED',
  'KYC_PENDING',
  'KYC_VERIFIED',
  'KYC_FAILED',
  'ACCOUNT_APPROVED',
  'ACCOUNT_ACTIVATED',
  'ACCOUNT_DEACTIVATED'
);

-- Swap the enum
ALTER TABLE "activities" ALTER COLUMN "type" TYPE "activity_type_new" USING ("type"::text::"activity_type_new");
DROP TYPE "activity_type";
ALTER TYPE "activity_type_new" RENAME TO "activity_type";
