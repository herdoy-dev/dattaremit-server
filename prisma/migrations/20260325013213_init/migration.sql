-- CreateIndex
CREATE INDEX "activities_created_at_idx" ON "activities"("created_at");

-- CreateIndex
CREATE INDEX "users_referredByCode_idx" ON "users"("referredByCode");

-- CreateIndex
CREATE INDEX "users_zynkEntityId_idx" ON "users"("zynkEntityId");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");