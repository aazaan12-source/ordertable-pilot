-- Add manager payment request tracking and reusable Super Admin payment accounts.
ALTER TABLE "BillingInvoice"
ADD COLUMN "paymentAccountId" TEXT,
ADD COLUMN "paymentClaimedAt" TIMESTAMP(3),
ADD COLUMN "paymentClaimMethod" TEXT,
ADD COLUMN "paymentClaimReference" TEXT,
ADD COLUMN "paymentClaimNote" TEXT,
ADD COLUMN "paymentConfirmedAt" TIMESTAMP(3),
ADD COLUMN "paymentConfirmedById" TEXT;

CREATE TABLE "BillingPaymentAccount" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT,
  "label" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "accountTitle" TEXT NOT NULL,
  "accountNumber" TEXT NOT NULL,
  "bankName" TEXT,
  "instructions" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BillingPaymentAccount_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BillingInvoice_paymentClaimedAt_idx" ON "BillingInvoice"("paymentClaimedAt");
CREATE INDEX "BillingPaymentAccount_restaurantId_isActive_idx" ON "BillingPaymentAccount"("restaurantId", "isActive");

ALTER TABLE "BillingInvoice"
ADD CONSTRAINT "BillingInvoice_paymentAccountId_fkey"
FOREIGN KEY ("paymentAccountId") REFERENCES "BillingPaymentAccount"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BillingPaymentAccount"
ADD CONSTRAINT "BillingPaymentAccount_restaurantId_fkey"
FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
