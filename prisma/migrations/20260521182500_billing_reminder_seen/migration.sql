-- Track when a manager has opened billing after a Super Admin reminder.
ALTER TABLE "BillingInvoice"
ADD COLUMN "paymentReminderSeenAt" TIMESTAMP(3);

CREATE INDEX "BillingInvoice_paymentReminderSeenAt_idx" ON "BillingInvoice"("paymentReminderSeenAt");
