-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "notification_type" ADD VALUE 'PROFILE_UPDATED';
ALTER TYPE "notification_type" ADD VALUE 'PASSWORD_CHANGED';

-- CreateIndex
CREATE INDEX "activities_created_at_idx" ON "activities"("created_at");

-- CreateIndex
CREATE INDEX "users_referredByCode_idx" ON "users"("referredByCode");

-- CreateIndex
CREATE INDEX "users_zynkEntityId_idx" ON "users"("zynkEntityId");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");
