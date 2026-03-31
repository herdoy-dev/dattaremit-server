-- Remove emailHash from users table and add unique constraint on email
DROP INDEX IF EXISTS "users_emailHash_key";
ALTER TABLE "users" DROP COLUMN "emailHash";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- Remove emailHash from recipients table and update unique constraint
DROP INDEX IF EXISTS "recipients_createdByUserId_emailHash_key";
ALTER TABLE "recipients" DROP COLUMN "emailHash";
CREATE UNIQUE INDEX "recipients_createdByUserId_email_key" ON "recipients"("createdByUserId", "email");
