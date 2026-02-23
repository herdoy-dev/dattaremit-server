-- AlterTable
ALTER TABLE "users" ADD COLUMN "referCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_referCode_key" ON "users"("referCode");
