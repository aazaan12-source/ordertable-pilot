import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { serializeOrder } from "@/lib/order-utils";
import { OrderStatusPanel } from "@/components/customer/order-status-panel";

export const dynamic = "force-dynamic";

export default async function OrderSuccessPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { table: true, restaurant: true, items: true, waiterRequests: true }
  });
  if (!order) notFound();
  return <OrderStatusPanel initialOrder={serializeOrder(order)} />;
}
