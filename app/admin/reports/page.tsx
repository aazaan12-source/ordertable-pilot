import Link from "next/link";
import { db } from "@/lib/db";
import { AdminBreadcrumbs } from "@/components/admin/admin-breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminPlatformReportsPage() {
  const [restaurants, activeRestaurants, orders, paidOrders, revenue, leads, invoicesDue] = await Promise.all([
    db.restaurant.count(),
    db.restaurant.count({ where: { status: "ACTIVE" } }),
    db.order.count(),
    db.order.count({ where: { status: "PAID" } }),
    db.order.aggregate({ where: { status: "PAID" }, _sum: { total: true }, _avg: { total: true } }),
    db.platformLead.count(),
    db.billingInvoice.aggregate({ where: { status: { in: ["DUE", "OVERDUE"] } }, _sum: { amount: true }, _count: true })
  ]);

  return (
    <main className="mx-auto max-w-7xl p-4 lg:p-6">
      <AdminBreadcrumbs items={[{ label: "Platform Reports" }]} />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Platform Reports</h1>
          <p className="text-sm text-muted-foreground">High-level platform totals. Restaurant-specific reports are inside each Restaurant Control Center.</p>
        </div>
        <Link href="/admin/restaurants"><Button variant="outline">View Restaurants</Button></Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat title="Total Restaurants" value={restaurants} />
        <Stat title="Active Restaurants" value={activeRestaurants} />
        <Stat title="Total Orders" value={orders} />
        <Stat title="Paid Orders" value={paidOrders} />
        <Stat title="Restaurant Revenue" value={formatCurrency(revenue._sum.total?.toString() || 0)} />
        <Stat title="Average Paid Order" value={formatCurrency(revenue._avg.total?.toString() || 0)} />
        <Stat title="Onboarding Requests" value={leads} />
        <Stat title="Open Billing" value={formatCurrency(invoicesDue._sum.amount?.toString() || 0)} />
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>Restaurant Reports</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">To view sales and order status for one restaurant, open Restaurants, click Manage, then open Reports.</p>
          <Link href="/admin/restaurants"><Button>Choose Restaurant</Button></Link>
        </CardContent>
      </Card>
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

