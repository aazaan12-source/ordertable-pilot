import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const [restaurants, activeRestaurants, leads, openInvoices, paidInvoices, orderRevenue, recentRestaurants, recentLeads] = await Promise.all([
    db.restaurant.count(),
    db.restaurant.count({ where: { status: "ACTIVE" } }),
    db.platformLead.count({ where: { status: "NEW" } }),
    db.billingInvoice.aggregate({ where: { status: { in: ["DUE", "OVERDUE"] } }, _sum: { amount: true }, _count: true }),
    db.billingInvoice.aggregate({ where: { status: "PAID" }, _sum: { amount: true }, _count: true }),
    db.order.aggregate({ where: { status: "PAID" }, _sum: { total: true } }),
    db.restaurant.findMany({
      include: {
        tables: true,
        users: true,
        orders: { where: { status: "PAID" }, select: { total: true } },
        billingInvoices: { orderBy: { createdAt: "desc" }, take: 1 }
      },
      orderBy: { createdAt: "desc" },
      take: 5
    }),
    db.platformLead.findMany({ orderBy: { createdAt: "desc" }, take: 5 })
  ]);

  return (
    <main className="mx-auto max-w-6xl p-4 lg:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Super Admin Control Center</h1>
          <p className="text-sm text-muted-foreground">Manage restaurant accounts, onboarding requests, account recovery, billing, and platform revenue.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/restaurants"><Button variant="outline">Manage Restaurants</Button></Link>
          <Link href="/admin/restaurants/new"><Button>Create Restaurant</Button></Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat title="Restaurants" value={restaurants} />
        <Stat title="Active Accounts" value={activeRestaurants} />
        <Stat title="New Requests" value={leads} />
        <Stat title="Open Billing" value={formatCurrency(openInvoices._sum.amount?.toString() || 0)} />
        <Stat title="Paid Platform Billing" value={formatCurrency(paidInvoices._sum.amount?.toString() || 0)} />
        <Stat title="Restaurant Order Revenue" value={formatCurrency(orderRevenue._sum.total?.toString() || 0)} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader><CardTitle>Restaurant Accounts</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {recentRestaurants.map((restaurant) => {
              const revenue = restaurant.orders.reduce((sum, order) => sum + Number(order.total), 0);
              const latestInvoice = restaurant.billingInvoices[0];
              return (
                <div key={restaurant.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">{restaurant.name}</p>
                      <p className="text-sm text-muted-foreground">{restaurant.city} · {restaurant.tables.length} tables · {restaurant.users.length} users</p>
                    </div>
                    <Link href={`/admin/restaurants/${restaurant.id}`}><Button variant="outline">Control</Button></Link>
                  </div>
                  <div className="mt-2 grid gap-2 text-sm md:grid-cols-3">
                    <p>Order revenue: <strong>{formatCurrency(revenue)}</strong></p>
                    <p>Status: <strong>{restaurant.status}</strong></p>
                    <p>Billing: <strong>{latestInvoice ? latestInvoice.status : "No invoice"}</strong></p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Latest Requests</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {recentLeads.map((lead) => (
              <div key={lead.id} className="rounded-md border p-3 text-sm">
                <p className="font-bold">{lead.restaurantName}</p>
                <p className="text-muted-foreground">{lead.contactName} · {lead.phone}</p>
                <p>{lead.city} · {lead.expectedTables} tables · {lead.status}</p>
              </div>
            ))}
            <Link href="/admin/onboarding-requests"><Button className="w-full">View Onboarding Requests</Button></Link>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function Stat({ title, value }: { title: string; value: React.ReactNode }) {
  return <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">{title}</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{value}</p></CardContent></Card>;
}
