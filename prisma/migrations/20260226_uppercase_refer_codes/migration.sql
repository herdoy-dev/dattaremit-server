-- Uppercase all existing referral codes
UPDATE users SET "referCode" = UPPER("referCode") WHERE "referCode" IS NOT NULL;
UPDATE users SET "referredByCode" = UPPER("referredByCode") WHERE "referredByCode" IS NOT NULL;
