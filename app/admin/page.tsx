import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPkDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [restaurants, activeRestaurants, pendingLeads, ordersToday, revenueToday, recentRestaurants, recentLeads] = await Promise.all([
    db.restaurant.count(),
    db.restaurant.count({ where: { status: "ACTIVE" } }),
    db.platformLead.count({ where: { status: "NEW" } }),
    db.order.count({ where: { createdAt: { gte: startOfDay } } }),
    db.order.aggregate({ where: { createdAt: { gte: startOfDay }, status: "PAID" }, _sum: { total: true } }),
    db.restaurant.findMany({
      include: {
        tables: { select: { status: true } },
        users: { where: { role: "RESTAURANT_MANAGER" }, select: { email: true }, take: 1 }
      },
      orderBy: { createdAt: "desc" },
      take: 5
    }),
    db.platformLead.findMany({ orderBy: { createdAt: "desc" }, take: 5 })
  ]);

  return (
    <main className="mx-auto max-w-7xl p-4 lg:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Overview</h1>
          <p className="text-sm text-muted-foreground">A quick view of restaurants, onboarding activity, and today's platform orders.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/restaurants/new"><Button>Add Restaurant</Button></Link>
          <Link href="/admin/restaurants"><Button variant="outline">View Restaurants</Button></Link>
          <Link href="/admin/onboarding-requests"><Button variant="outline">Onboarding Requests</Button></Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat title="Total Restaurants" value={restaurants} />
        <Stat title="Active Restaurants" value={activeRestaurants} />
        <Stat title="Pending Requests" value={pendingLeads} />
        <Stat title="Orders Today" value={ordersToday} />
        <Stat title="Revenue Today" value={formatCurrency(revenueToday._sum.total?.toString() || 0)} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Recent Restaurants</CardTitle>
            <Link href="/admin/restaurants" className="text-sm font-semibold text-primary hover:underline">View all</Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentRestaurants.map((restaurant) => {
              const activeTables = restaurant.tables.filter((table) => table.status !== "INACTIVE").length;
              const manager = restaurant.users[0];
              return (
                <div key={restaurant.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold">{restaurant.name}</p>
                    <p className="text-sm text-muted-foreground">{restaurant.branchName} - {restaurant.city} - {activeTables} active tables</p>
                    <p className="break-all text-xs text-muted-foreground">Manager: {manager?.email || "Missing"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={restaurant.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-700"}>{restaurant.status}</Badge>
                    <Link href={`/admin/restaurants/${restaurant.id}`}><Button size="sm" variant="outline">Manage</Button></Link>
                  </div>
                </div>
              );
            })}
            {recentRestaurants.length === 0 ? (
              <div className="rounded-md border bg-muted/30 p-6 text-center">
                <p className="font-semibold">No restaurants added yet.</p>
                <Link href="/admin/restaurants/new" className="mt-3 inline-block"><Button>Add First Restaurant</Button></Link>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Recent Onboarding Requests</CardTitle>
            <Link href="/admin/onboarding-requests" className="text-sm font-semibold text-primary hover:underline">View all</Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentLeads.map((lead) => (
              <div key={lead.id} className="rounded-md border p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{lead.restaurantName}</p>
                    <p className="text-muted-foreground">{lead.contactName} - {lead.phone}</p>
                    <p className="text-xs text-muted-foreground">{lead.city} - {formatPkDateTime(lead.createdAt)}</p>
                  </div>
                  <Badge className={lead.status === "NEW" ? "bg-orange-100 text-orange-800" : "bg-muted text-foreground"}>{lead.status}</Badge>
                </div>
              </div>
            ))}
            {recentLeads.length === 0 ? <p className="rounded-md border bg-muted/30 p-6 text-center text-sm text-muted-foreground">No onboarding requests yet.</p> : null}
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
