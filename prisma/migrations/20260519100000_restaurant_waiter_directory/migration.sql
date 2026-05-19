CREATE TABLE IF NOT EXISTS "RestaurantWaiter" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RestaurantWaiter_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RestaurantWaiter_restaurantId_fkey'
  ) THEN
    ALTER TABLE "RestaurantWaiter"
      ADD CONSTRAINT "RestaurantWaiter_restaurantId_fkey"
      FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "RestaurantWaiter_restaurantId_name_key" ON "RestaurantWaiter"("restaurantId", "name");
CREATE INDEX IF NOT EXISTS "RestaurantWaiter_restaurantId_isActive_idx" ON "RestaurantWaiter"("restaurantId", "isActive");
CREATE INDEX IF NOT EXISTS "RestaurantWaiter_restaurantId_sortOrder_idx" ON "RestaurantWaiter"("restaurantId", "sortOrder");
