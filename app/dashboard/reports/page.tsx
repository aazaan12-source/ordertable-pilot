import Link from "next/link";
import { db } from "@/lib/db";
import { getManagerRestaurant } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatPkTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { restaurant } = await getManagerRestaurant();
  const { month = new Date().toISOString().slice(0, 7) } = await searchParams;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthStart = new Date(`${month}-01T00:00:00`);
  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);
  const previousMonth = new Date();
  previousMonth.setMonth(previousMonth.getMonth() - 1);
  const previousMonthValue = previousMonth.toISOString().slice(0, 7);

  const [orders, revenue, pending, paid, cancelled, monthRevenue, monthOrders, mostOrdered, history] = await Promise.all([
    db.order.count({ where: { restaurantId: restaurant.id, createdAt: { gte: today } } }),
    db.order.aggregate({ where: { restaurantId: restaurant.id, status: "PAID", createdAt: { gte: today } }, _sum: { total: true }, _avg: { total: true } }),
    db.order.count({ where: { restaurantId: restaurant.id, status: "PENDING", createdAt: { gte: today } } }),
    db.order.count({ where: { restaurantId: restaurant.id, status: "PAID", createdAt: { gte: today } } }),
    db.order.count({ where: { restaurantId: restaurant.id, status: "CANCELLED", createdAt: { gte: today } } }),
    db.order.aggregate({ where: { restaurantId: restaurant.id, status: "PAID", createdAt: { gte: monthStart, lt: monthEnd } }, _sum: { total: true }, _avg: { total: true } }),
    db.order.count({ where: { restaurantId: restaurant.id, createdAt: { gte: monthStart, lt: monthEnd } } }),
    db.orderItem.groupBy({
      by: ["itemName"],
      where: { order: { restaurantId: restaurant.id, status: { not: "CANCELLED" }, createdAt: { gte: monthStart, lt: monthEnd } } },
      _sum: { quantity: true, totalPrice: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 8
    }),
    db.order.findMany({ where: { restaurantId: restaurant.id }, include: { table: true }, orderBy: { createdAt: "desc" }, take: 30 })
  ]);
  return (
    <main className="p-4 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-sm text-muted-foreground">Live sales and printable monthly statement reports.</p>
        </div>
        <Link href={`/dashboard/reports/monthly?month=${month}`} target="_blank">
          <Button>Generate PDF Statement</Button>
        </Link>
      </div>

      <div className="mt-5 rounded-lg border border-orange-300 bg-orange-50 p-4 text-orange-950">
        <p className="font-bold">Monthly statement reminder</p>
        <p className="mt-1 text-sm">At month end, create a PDF statement for records. Use the button above for the selected month. Order history remains safely in the database.</p>
        <Link href={`/dashboard/reports/monthly?month=${previousMonthValue}`} target="_blank" className="mt-3 inline-block text-sm font-bold underline">
          Generate last month statement
        </Link>
      </div>

      <form className="mt-5 flex flex-wrap items-end gap-3">
        <label className="text-sm font-semibold">
          Report month
          <input type="month" name="month" defaultValue={month} className="mt-1 block h-10 rounded-md border bg-white px-3 text-sm" />
        </label>
        <Button>Load Month</Button>
      </form>

      <div className="mt-5 grid gap-4 md:grid-cols-4">
        <Stat title="Orders today" value={orders} />
        <Stat title="Revenue today" value={formatCurrency(revenue._sum.total?.toString() || 0)} />
        <Stat title="Average today" value={formatCurrency(revenue._avg.total?.toString() || 0)} />
        <Stat title="Pending today" value={pending} />
        <Stat title="Paid today" value={paid} />
        <Stat title="Cancelled today" value={cancelled} />
        <Stat title="Monthly orders" value={monthOrders} />
        <Stat title="Monthly revenue" value={formatCurrency(monthRevenue._sum.total?.toString() || 0)} />
      </div>
      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Most ordered items in {month}</CardTitle></CardHeader>
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
          <CardHeader><CardTitle>Recent order history</CardTitle></CardHeader>
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
