-- Track when a manager has seen a rejected payment claim.
ALTER TABLE "BillingInvoice"
ADD COLUMN "paymentRejectionSeenAt" TIMESTAMP(3);

CREATE INDEX "BillingInvoice_paymentRejectionSeenAt_idx" ON "BillingInvoice"("paymentRejectionSeenAt");
