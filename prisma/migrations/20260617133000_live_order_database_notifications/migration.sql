CREATE OR REPLACE FUNCTION notify_ordertable_live_orders()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_restaurant_id text;
BEGIN
  target_restaurant_id := COALESCE(NEW."restaurantId", OLD."restaurantId");
  IF target_restaurant_id IS NOT NULL THEN
    PERFORM pg_notify('ordertable_live_orders', target_restaurant_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS "Order_live_orders_notify" ON "Order";
CREATE TRIGGER "Order_live_orders_notify"
AFTER INSERT OR UPDATE OR DELETE ON "Order"
FOR EACH ROW
EXECUTE FUNCTION notify_ordertable_live_orders();

DROP TRIGGER IF EXISTS "WaiterRequest_live_orders_notify" ON "WaiterRequest";
CREATE TRIGGER "WaiterRequest_live_orders_notify"
AFTER INSERT OR UPDATE OR DELETE ON "WaiterRequest"
FOR EACH ROW
EXECUTE FUNCTION notify_ordertable_live_orders();
