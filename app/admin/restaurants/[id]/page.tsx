import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/permissions";
import { deleteRestaurantCompletely, toggleOrdering, toggleRestaurantStatus } from "@/lib/admin-restaurant-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { formatCurrency, formatPkDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminRestaurantDetail({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requirePlatformAdmin();
  const { id } = await params;
  const { error } = await searchParams;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const restaurant = await db.restaurant.findUnique({
    where: { id },
    include: {
      users: { where: { role: "RESTAURANT_MANAGER" }, orderBy: { createdAt: "asc" } },
      tables: true,
      categories: true,
      menuItems: true,
      orders: { select: { id: true, total: true, createdAt: true } },
      activityLogs: { orderBy: { createdAt: "desc" }, take: 8 }
    }
  });
  if (!restaurant) notFound();

  const activeTables = restaurant.tables.filter((table) => table.status !== "INACTIVE").length;
  const inactiveTables = restaurant.tables.length - activeTables;
  const ordersToday = restaurant.orders.filter((order) => order.createdAt >= startOfDay);
  const revenueToday = ordersToday.reduce((sum, order) => sum + Number(order.total), 0);
  const revenueAllTime = restaurant.orders.reduce((sum, order) => sum + Number(order.total), 0);
  const manager = restaurant.users[0];
  const baseUrl = (process.env.APP_URL || process.env.NEXTAUTH_URL || "").replace(/\/$/, "");
  const customerUrlPattern = `${baseUrl || "[APP_URL]"}/r/${restaurant.slug}/t/[table-number]`;
  const customerExampleUrl = `${baseUrl || ""}/r/${restaurant.slug}/t/1`;

  return (
    <main className="mx-auto max-w-7xl p-4 lg:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{restaurant.name}</h1>
          <p className="text-sm text-muted-foreground">{restaurant.branchName} · {restaurant.city} · /r/{restaurant.slug}/t/[table]</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/restaurants/${restaurant.id}/edit`}><Button variant="outline">Edit Restaurant</Button></Link>
          <Link href={`/admin/restaurants/${restaurant.id}/tables`}><Button variant="outline">Manage Tables</Button></Link>
          <Link href={`/admin/restaurants/${restaurant.id}/qr-codes`}><Button>View QR Codes</Button></Link>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <Badge className={restaurant.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-700"}>{restaurant.status}</Badge>
        <Badge className={restaurant.orderingEnabled ? "bg-blue-100 text-blue-800" : "bg-orange-100 text-orange-800"}>{restaurant.orderingEnabled ? "Ordering Enabled" : "Ordering Disabled"}</Badge>
        <Badge className="bg-muted text-foreground">{restaurant.subscriptionStatus}</Badge>
      </div>

      {error === "delete-confirmation" ? (
        <div className="mb-5 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          Restaurant was not deleted. Type the restaurant slug exactly before pressing Delete Restaurant.
        </div>
      ) : null}
      {error === "delete-active" ? (
        <div className="mb-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800">
          Restaurant was not deleted. Deactivate the restaurant first, then delete it if you are sure.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <Stat title="Active Tables" value={activeTables} sub={`${inactiveTables} inactive`} />
        <Stat title="Menu" value={`${restaurant.categories.length} / ${restaurant.menuItems.length}`} sub="categories / items" />
        <Stat title="Orders Today" value={ordersToday.length} sub={formatCurrency(revenueToday)} />
        <Stat title="Revenue All Time" value={formatCurrency(revenueAllTime)} sub={`${restaurant.orders.length} total orders`} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Live Access</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-2">
            <Info label="Customer QR Pattern" value={<span className="break-all">{customerUrlPattern}</span>} />
            <Info label="Table 1 Example" value={<span className="break-all">{customerExampleUrl || `/r/${restaurant.slug}/t/1`}</span>} />
            <Info label="Manager Dashboard" value="/dashboard" />
            <Info label="Dashboard Reuse" value="Same interface as demo restaurant, filtered to this manager's restaurant data." />
            {!baseUrl ? (
              <p className="rounded-md border bg-amber-50 p-2 text-xs text-amber-800 md:col-span-2">
                APP_URL/NEXTAUTH_URL is missing, so QR records may be relative. Set APP_URL in Vercel before printing final QR codes.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Restaurant Overview</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-2">
            <Info label="Slug" value={restaurant.slug} />
            <Info label="Phone" value={restaurant.phone || "Not set"} />
            <Info label="Address" value={restaurant.address || "Not set"} />
            <Info label="Manager" value={manager?.email || "No manager login"} />
            <Info label="Service Charge" value={`${restaurant.serviceChargePercent}%`} />
            <Info label="Tax" value={`${restaurant.taxPercent}%`} />
            <Info label="Cancel Window" value={`${restaurant.customerCancelWindowMinutes} minutes`} />
            <Info label="Created" value={formatPkDateTime(restaurant.createdAt)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
          <CardContent className="grid gap-2">
            <Link href={`/admin/restaurants/${restaurant.id}/menu/categories`}><Button className="w-full" variant="outline">Manage Categories</Button></Link>
            <Link href={`/admin/restaurants/${restaurant.id}/menu/items`}><Button className="w-full" variant="outline">Manage Menu Items</Button></Link>
            <Link href={`/admin/restaurants/${restaurant.id}/manager`}><Button className="w-full" variant="outline">Manager Login</Button></Link>
            <Link href={`/admin/restaurants/${restaurant.id}/orders`}><Button className="w-full" variant="outline">View Orders</Button></Link>
            <Link href={`/admin/restaurants/${restaurant.id}/reports`}><Button className="w-full" variant="outline">View Reports</Button></Link>
            <form action={toggleRestaurantStatus}>
              <input type="hidden" name="id" value={restaurant.id} />
              <input type="hidden" name="status" value={restaurant.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"} />
              <Button className="w-full" variant={restaurant.status === "ACTIVE" ? "destructive" : "secondary"}>{restaurant.status === "ACTIVE" ? "Deactivate Restaurant" : "Activate Restaurant"}</Button>
            </form>
            <form action={toggleOrdering}>
              <input type="hidden" name="id" value={restaurant.id} />
              <input type="hidden" name="orderingEnabled" value={String(!restaurant.orderingEnabled)} />
              <Button className="w-full" variant="outline">{restaurant.orderingEnabled ? "Disable Ordering" : "Enable Ordering"}</Button>
            </form>
            {restaurant.status === "INACTIVE" ? (
              <form action={deleteRestaurantCompletely} className="rounded-md border border-red-200 bg-red-50 p-3">
                <input type="hidden" name="restaurantId" value={restaurant.id} />
                <label className="text-xs font-semibold text-red-900">
                  Delete permanently only after deactivation. Type slug:
                  <input
                    name="confirmation"
                    placeholder={restaurant.slug}
                    className="mt-2 h-9 w-full rounded-md border bg-white px-3 text-sm text-foreground"
                  />
                </label>
                <p className="mt-2 text-xs text-red-800">
                  This deletes manager logins, tables, QR codes, menu, orders, bills, reports, requests, feedback, and restaurant records.
                </p>
                <ConfirmSubmitButton
                  className="mt-2 w-auto"
                  size="sm"
                  message={`Permanent delete warning:\n\nThis will delete ${restaurant.name} completely, including manager logins, tables, QR codes, menu, orders, bills, reports, waiter requests, feedback, and restaurant records.\n\nThis cannot be undone.\n\nContinue only if this restaurant is no longer needed.`}
                  pendingText="Deleting..."
                >
                  Delete
                </ConfirmSubmitButton>
              </form>
            ) : (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                Delete is locked while restaurant is active. Deactivate restaurant first to unlock permanent delete.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Recent Admin Activity</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {restaurant.activityLogs.map((log) => (
              <p key={log.id} className="flex flex-wrap justify-between gap-3 border-b pb-2 text-sm">
                <span><strong>{log.action}</strong> · {log.description}</span>
                <span className="text-muted-foreground">{formatPkDateTime(log.createdAt)}</span>
              </p>
            ))}
            {restaurant.activityLogs.length === 0 ? <p className="text-sm text-muted-foreground">No activity recorded yet.</p> : null}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function Stat({ title, value, sub }: { title: string; value: React.ReactNode; sub: string }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm text-muted-foreground">{title}</CardTitle></CardHeader>
      <CardContent><p className="text-2xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{sub}</p></CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return <p><span className="text-muted-foreground">{label}: </span><strong>{value}</strong></p>;
}
