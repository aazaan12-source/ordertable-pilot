import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { formatCurrency, formatPkTime } from "@/lib/utils";

export default async function AdminRestaurantOrders({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdmin();
  const { id } = await params;
  const restaurant = await db.restaurant.findUnique({
    where: { id },
    include: {
      orders: { include: { table: true, items: true }, orderBy: { createdAt: "desc" }, take: 50 }
    }
  });
  if (!restaurant) notFound();
  return (
    <main className="mx-auto max-w-6xl p-4 lg:p-6">
      <h1 className="text-2xl font-bold">{restaurant.name} Orders</h1>
      <div className="mt-5 grid gap-4">
        {restaurant.orders.map((order) => (
          <Card key={order.id}>
            <CardHeader>
              <div className="flex justify-between gap-3">
                <div>
                  <CardTitle>{order.orderNumber} · Table {order.table.tableNumber}</CardTitle>
                  <p className="text-sm text-muted-foreground">{formatPkTime(order.createdAt)}</p>
                </div>
                <StatusBadge status={order.status} />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{order.items.map((item) => `${item.quantity} x ${item.itemName}`).join(", ")}</p>
              <p className="mt-2 font-bold">{formatCurrency(order.total.toString())}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
