import { db } from "@/lib/db";
import { getManagerRestaurant } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatPkTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const { restaurant } = await getManagerRestaurant();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [orders, revenue, pending, paid, cancelled, mostOrdered, history] = await Promise.all([
    db.order.count({ where: { restaurantId: restaurant.id, createdAt: { gte: today } } }),
    db.order.aggregate({ where: { restaurantId: restaurant.id, status: "PAID", createdAt: { gte: today } }, _sum: { total: true }, _avg: { total: true } }),
    db.order.count({ where: { restaurantId: restaurant.id, status: "PENDING", createdAt: { gte: today } } }),
    db.order.count({ where: { restaurantId: restaurant.id, status: "PAID", createdAt: { gte: today } } }),
    db.order.count({ where: { restaurantId: restaurant.id, status: "CANCELLED", createdAt: { gte: today } } }),
    db.orderItem.groupBy({
      by: ["itemName"],
      where: { order: { restaurantId: restaurant.id, status: { not: "CANCELLED" } } },
      _sum: { quantity: true, totalPrice: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 8
    }),
    db.order.findMany({ where: { restaurantId: restaurant.id }, include: { table: true }, orderBy: { createdAt: "desc" }, take: 20 })
  ]);
  return (
    <main className="p-4 lg:p-6">
      <h1 className="text-2xl font-bold">Reports</h1>
      <div className="mt-5 grid gap-4 md:grid-cols-4">
        <Stat title="Orders today" value={orders} />
        <Stat title="Revenue today" value={formatCurrency(revenue._sum.total?.toString() || 0)} />
        <Stat title="Average order" value={formatCurrency(revenue._avg.total?.toString() || 0)} />
        <Stat title="Pending" value={pending} />
        <Stat title="Paid" value={paid} />
        <Stat title="Cancelled" value={cancelled} />
      </div>
      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Most ordered items</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {mostOrdered.map((item) => (
              <div key={item.itemName} className="flex justify-between border-b pb-2 text-sm">
                <span>{item.itemName}</span>
                <span>{item._sum.quantity || 0} sold · {formatCurrency(item._sum.totalPrice?.toString() || 0)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Order history</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {history.map((order) => (
              <div key={order.id} className="grid grid-cols-4 gap-2 border-b pb-2 text-sm">
                <span>{formatPkTime(order.createdAt)}</span>
                <span>{order.orderNumber}</span>
                <span>Table {order.table.tableNumber}</span>
                <span className="text-right">{order.status} · {formatCurrency(order.total.toString())}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function Stat({ title, value }: { title: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm text-muted-foreground">{title}</CardTitle></CardHeader>
      <CardContent><p className="text-2xl font-bold">{value}</p></CardContent>
    </Card>
  );
}
