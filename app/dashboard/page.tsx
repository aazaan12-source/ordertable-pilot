import Link from "next/link";
import { db } from "@/lib/db";
import { getManagerRestaurant } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FinancialAmount } from "@/components/dashboard/financial-amount";

export const dynamic = "force-dynamic";

export default async function DashboardHome() {
  const { restaurant } = await getManagerRestaurant();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [pending, paid, revenue, waiterRequests] = await Promise.all([
    db.order.count({ where: { restaurantId: restaurant.id, status: "PENDING", createdAt: { gte: today } } }),
    db.order.count({ where: { restaurantId: restaurant.id, status: "PAID", createdAt: { gte: today } } }),
    db.order.aggregate({ where: { restaurantId: restaurant.id, status: "PAID", createdAt: { gte: today } }, _sum: { total: true } }),
    db.waiterRequest.count({ where: { restaurantId: restaurant.id, status: "PENDING" } })
  ]);

  return (
    <main className="p-4 lg:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Today at {restaurant.name}</h1>
          <p className="text-sm text-muted-foreground">Quick view for restaurant staff.</p>
        </div>
        <Link href="/dashboard/orders"><Button>Open Live Orders</Button></Link>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Stat title="Pending orders" value={pending} />
        <Stat title="Paid orders" value={paid} />
        <Stat title="Revenue today" value={<FinancialAmount value={revenue._sum.total?.toString() || 0} />} />
        <Stat title="Open requests" value={waiterRequests} />
      </div>
    </main>
  );
}

function Stat({ title, value }: { title: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm text-muted-foreground">{title}</CardTitle></CardHeader>
      <CardContent><p className="text-3xl font-bold">{value}</p></CardContent>
    </Card>
  );
}
