-- CreateEnum
CREATE TYPE "transaction_status" AS ENUM ('SIMULATED', 'ACCEPTED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "receiverId" UUID NOT NULL,
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
CREATE UNIQUE INDEX "transactions_zynkTransactionId_key" ON "transactions"("zynkTransactionId");

-- CreateIndex
CREATE INDEX "transactions_senderId_idx" ON "transactions"("senderId");

-- CreateIndex
CREATE INDEX "transactions_receiverId_idx" ON "transactions"("receiverId");

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");

-- CreateIndex
CREATE INDEX "transactions_created_at_idx" ON "transactions"("created_at");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
