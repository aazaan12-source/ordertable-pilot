-- Durable security records for serverless deployments.
ALTER TABLE "ActivityLog" ADD COLUMN IF NOT EXISTS "ipAddress" TEXT;
ALTER TABLE "ActivityLog" ADD COLUMN IF NOT EXISTS "userAgent" TEXT;

CREATE TABLE IF NOT EXISTS "LoginAttempt" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ipAddress" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PublicOrderAttempt" (
    "id" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "restaurantId" TEXT,
    "tableNumber" INTEGER,
    "customerSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PublicOrderAttempt_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PublicOrderAttempt_restaurantId_fkey'
  ) THEN
    ALTER TABLE "PublicOrderAttempt"
      ADD CONSTRAINT "PublicOrderAttempt_restaurantId_fkey"
      FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "User_restaurantId_idx" ON "User"("restaurantId");
CREATE INDEX IF NOT EXISTS "RestaurantTable_restaurantId_idx" ON "RestaurantTable"("restaurantId");
CREATE INDEX IF NOT EXISTS "RestaurantTable_tableNumber_idx" ON "RestaurantTable"("tableNumber");
CREATE INDEX IF NOT EXISTS "Category_restaurantId_idx" ON "Category"("restaurantId");
CREATE INDEX IF NOT EXISTS "MenuItem_restaurantId_idx" ON "MenuItem"("restaurantId");
CREATE INDEX IF NOT EXISTS "MenuItem_categoryId_idx" ON "MenuItem"("categoryId");
CREATE INDEX IF NOT EXISTS "Order_restaurantId_idx" ON "Order"("restaurantId");
CREATE INDEX IF NOT EXISTS "Order_tableId_idx" ON "Order"("tableId");
CREATE INDEX IF NOT EXISTS "Order_createdAt_idx" ON "Order"("createdAt");
CREATE INDEX IF NOT EXISTS "ActivityLog_restaurantId_idx" ON "ActivityLog"("restaurantId");
CREATE INDEX IF NOT EXISTS "ActivityLog_userId_idx" ON "ActivityLog"("userId");
CREATE INDEX IF NOT EXISTS "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");
CREATE INDEX IF NOT EXISTS "LoginAttempt_email_createdAt_idx" ON "LoginAttempt"("email", "createdAt");
CREATE INDEX IF NOT EXISTS "LoginAttempt_ipAddress_createdAt_idx" ON "LoginAttempt"("ipAddress", "createdAt");
CREATE INDEX IF NOT EXISTS "LoginAttempt_success_createdAt_idx" ON "LoginAttempt"("success", "createdAt");
CREATE INDEX IF NOT EXISTS "PublicOrderAttempt_ipAddress_createdAt_idx" ON "PublicOrderAttempt"("ipAddress", "createdAt");
CREATE INDEX IF NOT EXISTS "PublicOrderAttempt_restaurantId_tableNumber_createdAt_idx" ON "PublicOrderAttempt"("restaurantId", "tableNumber", "createdAt");
CREATE INDEX IF NOT EXISTS "PublicOrderAttempt_customerSessionId_createdAt_idx" ON "PublicOrderAttempt"("customerSessionId", "createdAt");
