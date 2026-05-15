import Link from "next/link";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RestaurantsPage() {
  const restaurants = await db.restaurant.findMany({
    include: {
      tables: true,
      users: true,
      orders: { where: { status: "PAID" }, select: { total: true } },
      billingInvoices: { orderBy: { createdAt: "desc" }, take: 3 }
    },
    orderBy: { createdAt: "desc" }
  });
  return (
    <main className="mx-auto max-w-6xl p-4 lg:p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Restaurant Accounts</h1>
          <p className="text-sm text-muted-foreground">Super-admin view of every restaurant, revenue, billing, and account access.</p>
        </div>
        <Link href="/admin/restaurants/new"><Button>New Restaurant</Button></Link>
      </div>
      <div className="grid gap-4">
        {restaurants.map((restaurant) => {
          const revenue = restaurant.orders.reduce((sum, order) => sum + Number(order.total), 0);
          const openBilling = restaurant.billingInvoices
            .filter((invoice) => invoice.status === "DUE" || invoice.status === "OVERDUE")
            .reduce((sum, invoice) => sum + Number(invoice.amount), 0);
          return (
            <Card key={restaurant.id}>
              <CardHeader>
                <CardTitle>{restaurant.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{restaurant.branchName} · {restaurant.city} · {restaurant.subscriptionStatus}</p>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 text-sm md:grid-cols-5">
                  <p>{restaurant.tables.length} tables</p>
                  <p>{restaurant.users.length} users</p>
                  <p>Status: <strong>{restaurant.status}</strong></p>
                  <p>Order revenue: <strong>{formatCurrency(revenue)}</strong></p>
                  <p>Open billing: <strong>{formatCurrency(openBilling)}</strong></p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/admin/restaurants/${restaurant.id}`}><Button variant="outline">Control</Button></Link>
                  <Link href={`/admin/restaurants/${restaurant.id}/tables`}><Button variant="outline">Tables</Button></Link>
                  <Link href={`/admin/restaurants/${restaurant.id}/qr-codes`}><Button variant="outline">QR Codes</Button></Link>
                  <Link href={`/admin/restaurants/${restaurant.id}/orders`}><Button variant="outline">Orders</Button></Link>
                  <Link href={`/admin/restaurants/${restaurant.id}/reports`}><Button>Reports</Button></Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </main>
  );
}
