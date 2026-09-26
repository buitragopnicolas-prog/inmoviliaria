ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'AWAITING_VERIFICATION';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'UNDER_REVIEW';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'REFUNDED';

ALTER TYPE "StoredFilePurpose" ADD VALUE IF NOT EXISTS 'PAYMENT_RECEIPT';

CREATE TYPE "ManualPaymentMethod" AS ENUM ('QR', 'BREB', 'BANK_TRANSFER', 'BANK_DEPOSIT');

ALTER TABLE "Payment"
  ADD COLUMN "manualMethod" "ManualPaymentMethod",
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "paidAt" TIMESTAMP(3),
  ADD COLUMN "reportedAt" TIMESTAMP(3),
  ADD COLUMN "receiptFileId" TEXT,
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewNote" TEXT;

CREATE TABLE "PaymentAuditEvent" (
  "id" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "actorId" TEXT,
  "fromStatus" "PaymentStatus",
  "toStatus" "PaymentStatus" NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");
CREATE UNIQUE INDEX "Payment_receiptFileId_key" ON "Payment"("receiptFileId");
CREATE INDEX "Payment_provider_status_reportedAt_idx" ON "Payment"("provider", "status", "reportedAt");
CREATE INDEX "PaymentAuditEvent_paymentId_createdAt_idx" ON "PaymentAuditEvent"("paymentId", "createdAt");

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_receiptFileId_fkey" FOREIGN KEY ("receiptFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentAuditEvent" ADD CONSTRAINT "PaymentAuditEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentAuditEvent" ADD CONSTRAINT "PaymentAuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
