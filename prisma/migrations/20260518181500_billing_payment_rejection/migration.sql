-- Track Super Admin rejection of manager payment claims.
ALTER TABLE "BillingInvoice"
ADD COLUMN "paymentRejectedAt" TIMESTAMP(3),
ADD COLUMN "paymentRejectionNote" TEXT;

CREATE INDEX "BillingInvoice_paymentRejectedAt_idx" ON "BillingInvoice"("paymentRejectedAt");
