import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/permissions";
import { AdminBreadcrumbs } from "@/components/admin/admin-breadcrumbs";
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
      <AdminBreadcrumbs items={[{ label: "Restaurants", href: "/admin/restaurants" }, { label: restaurant.name, href: `/admin/restaurants/${restaurant.id}` }, { label: "Orders" }]} />
      <div>
        <h1 className="text-2xl font-bold">Orders</h1>
        <p className="text-sm text-muted-foreground">View recent orders and order history for {restaurant.name}.</p>
      </div>
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
      {restaurant.orders.length === 0 ? <p className="mt-5 rounded-lg border bg-white p-6 text-center text-muted-foreground">No orders found for this restaurant yet.</p> : null}
    </main>
  );
}
