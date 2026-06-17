CREATE INDEX "Order_restaurantId_createdAt_idx" ON "Order"("restaurantId", "createdAt");

CREATE INDEX "Order_restaurantId_updatedAt_idx" ON "Order"("restaurantId", "updatedAt");

CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

CREATE INDEX "WaiterRequest_orderId_idx" ON "WaiterRequest"("orderId");

CREATE INDEX "WaiterRequest_restaurantId_status_createdAt_idx" ON "WaiterRequest"("restaurantId", "status", "createdAt");
