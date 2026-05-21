ALTER TABLE "BillingInvoice"
ADD COLUMN "invoiceSeenAt" TIMESTAMP(3),
ADD COLUMN "paymentClaimSeenAt" TIMESTAMP(3),
ADD COLUMN "paymentConfirmationSeenAt" TIMESTAMP(3);

CREATE INDEX "BillingInvoice_invoiceSeenAt_idx" ON "BillingInvoice"("invoiceSeenAt");
CREATE INDEX "BillingInvoice_paymentClaimSeenAt_idx" ON "BillingInvoice"("paymentClaimSeenAt");
CREATE INDEX "BillingInvoice_paymentConfirmationSeenAt_idx" ON "BillingInvoice"("paymentConfirmationSeenAt");
