-- Track manager payment source details and Super Admin invoice reminders.
ALTER TABLE "BillingInvoice"
ADD COLUMN "paymentClaimFromAccount" TEXT,
ADD COLUMN "paymentReminderAt" TIMESTAMP(3),
ADD COLUMN "paymentReminderCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "paymentReminderMessage" TEXT;

CREATE INDEX "BillingInvoice_paymentReminderAt_idx" ON "BillingInvoice"("paymentReminderAt");
