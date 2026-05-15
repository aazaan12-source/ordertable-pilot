import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

export default async function AdminRestaurantReports({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdmin();
  const { id } = await params;
  const restaurant = await db.restaurant.findUnique({ where: { id } });
  if (!restaurant) notFound();
  const [orders, paid, cancelled, revenue, statuses] = await Promise.all([
    db.order.count({ where: { restaurantId: id } }),
    db.order.count({ where: { restaurantId: id, status: "PAID" } }),
    db.order.count({ where: { restaurantId: id, status: "CANCELLED" } }),
    db.order.aggregate({ where: { restaurantId: id, status: "PAID" }, _sum: { total: true }, _avg: { total: true } }),
    db.order.groupBy({ by: ["status"], where: { restaurantId: id }, _count: { status: true } })
  ]);
  return (
    <main className="mx-auto max-w-6xl p-4 lg:p-6">
      <h1 className="text-2xl font-bold">{restaurant.name} Reports</h1>
      <div className="mt-5 grid gap-4 md:grid-cols-4">
        <Stat title="Total orders" value={orders} />
        <Stat title="Paid orders" value={paid} />
        <Stat title="Cancelled" value={cancelled} />
        <Stat title="Revenue" value={formatCurrency(revenue._sum.total?.toString() || 0)} />
        <Stat title="Avg order" value={formatCurrency(revenue._avg.total?.toString() || 0)} />
      </div>
      <Card className="mt-5">
        <CardHeader><CardTitle>Orders by status</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {statuses.map((status) => <p key={status.status} className="flex justify-between border-b pb-2"><span>{status.status}</span><strong>{status._count.status}</strong></p>)}
        </CardContent>
      </Card>
    </main>
  );
}

function Stat({ title, value }: { title: string; value: React.ReactNode }) {
  return <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">{title}</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{value}</p></CardContent></Card>;
}
