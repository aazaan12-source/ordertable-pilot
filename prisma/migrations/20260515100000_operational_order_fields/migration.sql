CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'JAZZCASH', 'EASYPAISA', 'OTHER');

ALTER TABLE "Restaurant"
ADD COLUMN "customerCancelWindowMinutes" INTEGER NOT NULL DEFAULT 3;

ALTER TABLE "Order"
ADD COLUMN "paymentMethod" "PaymentMethod",
ADD COLUMN "cancelledAt" TIMESTAMP(3),
ADD COLUMN "cancellationReason" TEXT,
ADD COLUMN "printedKitchenAt" TIMESTAMP(3),
ADD COLUMN "printedBillAt" TIMESTAMP(3);
