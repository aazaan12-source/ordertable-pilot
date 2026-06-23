import Link from "next/link";
import { db } from "@/lib/db";
import { AdminBreadcrumbs } from "@/components/admin/admin-breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportRangeControls, GroupedSalesTable } from "@/components/reports/report-sections";
import { resolveReportRange, buildCategoryRows, buildDepartmentRows } from "@/lib/reports";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

type ReportQuery = {
  range?: string;
  from?: string;
  to?: string;
};

export default async function AdminPlatformReportsPage({ searchParams }: { searchParams: Promise<ReportQuery> }) {
  const query = await searchParams;
  const range = resolveReportRange(query.range, query.from, query.to);
  const periodWhere = { createdAt: { gte: range.fromDate, lt: range.toExclusiveDate } };

  const [restaurants, activeRestaurants, leads, invoicesDue, periodOrders] = await Promise.all([
    db.restaurant.count(),
    db.restaurant.count({ where: { status: "ACTIVE" } }),
    db.platformLead.count(),
    db.billingInvoice.aggregate({ where: { status: { in: ["DUE", "OVERDUE"] } }, _sum: { amount: true }, _count: true }),
    db.order.findMany({
      where: periodWhere,
      include: { items: { include: { menuItem: { include: { category: { include: { department: true } } } } } } }
    })
  ]);

  const paidOrders = periodOrders.filter((order) => order.status === "PAID");
  const periodRevenue = paidOrders.reduce((sum, order) => sum + Number(order.total), 0);
  const averagePaidOrder = paidOrders.length ? periodRevenue / paidOrders.length : 0;
  const categoryRows = buildCategoryRows(periodOrders);
  const departmentRows = buildDepartmentRows(periodOrders);

  return (
    <main className="mx-auto max-w-7xl p-4 lg:p-6">
      <AdminBreadcrumbs items={[{ label: "Platform Reports" }]} />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Platform Reports</h1>
          <p className="text-sm text-muted-foreground">Category and department sales across all restaurants for the selected period.</p>
        </div>
        <Link href="/admin/restaurants"><Button variant="outline">View Restaurants</Button></Link>
      </div>

      <ReportRangeControls range={range} className="mb-5" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat title="Total Restaurants" value={restaurants} />
        <Stat title="Active Restaurants" value={activeRestaurants} />
        <Stat title="Orders (period)" value={periodOrders.length} />
        <Stat title="Paid Orders (period)" value={paidOrders.length} />
        <Stat title="Revenue (period)" value={formatCurrency(periodRevenue)} />
        <Stat title="Average Paid Order" value={formatCurrency(averagePaidOrder)} />
        <Stat title="Onboarding Requests" value={leads} />
        <Stat title="Open Billing" value={formatCurrency(invoicesDue._sum.amount?.toString() || 0)} />
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        Period: {range.label} ({range.fromStr} to {range.toStr}). Category and department sales are aggregated by name across every restaurant.
      </p>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <GroupedSalesTable
          title="Department-wise Sales"
          subtitle="Revenue grouped by department across all restaurants. Items not assigned to a department appear under Unassigned."
          groupLabel="Department"
          rows={departmentRows}
          emptyText="No department sales in this period."
        />
        <GroupedSalesTable
          title="Category-wise Sales"
          subtitle="Revenue grouped by menu category across all restaurants."
          groupLabel="Category"
          rows={categoryRows}
          emptyText="No category sales in this period."
        />
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>Per-Restaurant Reports</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">For one restaurant's full sales and order details, open Restaurants, click Manage, then open Reports.</p>
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
