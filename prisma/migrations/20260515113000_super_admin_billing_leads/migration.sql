CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'CONVERTED', 'CLOSED');
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'DUE', 'PAID', 'OVERDUE', 'WAIVED');

CREATE TABLE "BillingInvoice" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "billingMonth" TEXT NOT NULL,
  "planName" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "status" "InvoiceStatus" NOT NULL DEFAULT 'DUE',
  "dueDate" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "paymentReference" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BillingInvoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformLead" (
  "id" TEXT NOT NULL,
  "restaurantName" TEXT NOT NULL,
  "contactName" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT,
  "city" TEXT NOT NULL,
  "expectedTables" INTEGER NOT NULL DEFAULT 20,
  "planInterest" TEXT,
  "message" TEXT,
  "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
  "source" TEXT NOT NULL DEFAULT 'WEBSITE',
  "convertedRestaurantId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PlatformLead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BillingInvoice_restaurantId_billingMonth_idx" ON "BillingInvoice"("restaurantId", "billingMonth");
CREATE INDEX "BillingInvoice_status_dueDate_idx" ON "BillingInvoice"("status", "dueDate");
CREATE INDEX "PlatformLead_status_createdAt_idx" ON "PlatformLead"("status", "createdAt");

ALTER TABLE "BillingInvoice"
ADD CONSTRAINT "BillingInvoice_restaurantId_fkey"
FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
