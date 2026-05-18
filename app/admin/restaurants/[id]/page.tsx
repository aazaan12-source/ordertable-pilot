import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, ClipboardList, FileText, KeyRound, MenuSquare, QrCode } from "lucide-react";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/permissions";
import { AdminBreadcrumbs } from "@/components/admin/admin-breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
      orders: { select: { id: true, total: true, createdAt: true, status: true } },
      activityLogs: { orderBy: { createdAt: "desc" }, take: 8 }
    }
  });
  if (!restaurant) notFound();

  const activeTables = restaurant.tables.filter((table) => table.status !== "INACTIVE").length;
  const inactiveTables = restaurant.tables.length - activeTables;
  const ordersToday = restaurant.orders.filter((order) => order.createdAt >= startOfDay);
  const paidOrders = restaurant.orders.filter((order) => order.status === "PAID");
  const revenueToday = ordersToday.reduce((sum, order) => sum + Number(order.total), 0);
  const revenueAllTime = paidOrders.reduce((sum, order) => sum + Number(order.total), 0);
  const manager = restaurant.users[0];

  return (
    <main className="mx-auto max-w-7xl p-4 lg:p-6">
      <AdminBreadcrumbs items={[{ label: "Restaurants", href: "/admin/restaurants" }, { label: restaurant.name }]} />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Restaurant Control Center</h1>
          <p className="text-sm text-muted-foreground">{restaurant.name} - {restaurant.branchName} - {restaurant.city}</p>
        </div>
        <Link href="/admin/restaurants"><Button variant="outline">Back to Restaurants</Button></Link>
      </div>

      <div className="mb-5 rounded-lg border bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">{restaurant.name}</h2>
            <p className="text-sm text-muted-foreground">{restaurant.branchName} - {restaurant.city} - /r/{restaurant.slug}/t/[table]</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className={restaurant.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-700"}>{restaurant.status}</Badge>
            <Badge className={restaurant.orderingEnabled ? "bg-blue-100 text-blue-800" : "bg-orange-100 text-orange-800"}>{restaurant.orderingEnabled ? "Ordering Enabled" : "Ordering Disabled"}</Badge>
            <Badge className="bg-muted text-foreground">{restaurant.subscriptionStatus}</Badge>
          </div>
        </div>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Info label="Manager email" value={manager?.email || "No manager login"} />
          <Info label="Active tables" value={`${activeTables}${inactiveTables ? ` (${inactiveTables} inactive)` : ""}`} />
          <Info label="Menu items" value={`${restaurant.categories.length} categories / ${restaurant.menuItems.length} items`} />
          <Info label="Created" value={formatPkDateTime(restaurant.createdAt)} />
        </div>
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat title="Orders Today" value={ordersToday.length} sub={formatCurrency(revenueToday)} />
        <Stat title="All-Time Paid Revenue" value={formatCurrency(revenueAllTime)} sub={`${paidOrders.length} paid orders`} />
        <Stat title="Active Tables" value={activeTables} sub={`${restaurant.tables.length} total records`} />
        <Stat title="Menu Size" value={restaurant.menuItems.length} sub={`${restaurant.categories.length} categories`} />
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ControlCard
          icon={<Building2 className="h-5 w-5" />}
          title="Restaurant Profile"
          description="Edit name, location, phone, slug, status, subscription, ordering settings, tax, and service charges."
          href={`/admin/restaurants/${restaurant.id}/edit`}
          button="Manage Profile"
        />
        <ControlCard
          icon={<QrCode className="h-5 w-5" />}
          title="Tables & QR Codes"
          description="Update table range, activate or hide tables, regenerate QR URLs, and print or download QR signs."
          href={`/admin/restaurants/${restaurant.id}/tables-qr`}
          button="Manage Tables & QR Codes"
        />
        <ControlCard
          icon={<MenuSquare className="h-5 w-5" />}
          title="Menu Management"
          description="Manage categories, menu items, prices, availability, photos, and drag-and-drop display sorting."
          href={`/admin/restaurants/${restaurant.id}/menu`}
          button="Manage Menu"
        />
        <ControlCard
          icon={<KeyRound className="h-5 w-5" />}
          title="Manager Login"
          description="Create or update the restaurant manager login and reset temporary passwords when needed."
          href={`/admin/restaurants/${restaurant.id}/manager`}
          button="Manage Login"
        />
        <ControlCard
          icon={<ClipboardList className="h-5 w-5" />}
          title="Orders"
          description="View recent restaurant orders, table numbers, order status, items, and totals."
          href={`/admin/restaurants/${restaurant.id}/orders`}
          button="View Orders"
        />
        <ControlCard
          icon={<FileText className="h-5 w-5" />}
          title="Reports"
          description="View sales counts, paid revenue, cancelled orders, average order value, and status summary."
          href={`/admin/restaurants/${restaurant.id}/reports`}
          button="View Reports"
        />
      </section>

      <Card className="mt-6">
        <CardHeader><CardTitle>Recent Admin Activity</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {restaurant.activityLogs.map((log) => (
            <p key={log.id} className="flex flex-wrap justify-between gap-3 border-b pb-2 text-sm">
              <span><strong>{log.action}</strong> - {log.description}</span>
              <span className="text-muted-foreground">{formatPkDateTime(log.createdAt)}</span>
            </p>
          ))}
          {restaurant.activityLogs.length === 0 ? <p className="text-sm text-muted-foreground">No activity recorded yet.</p> : null}
        </CardContent>
      </Card>
    </main>
  );
}

function ControlCard({ icon, title, description, href, button }: { icon: React.ReactNode; title: string; description: string; href: string; button: string }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-muted text-foreground">{icon}</div>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex h-[calc(100%-96px)] flex-col justify-between gap-4">
        <p className="text-sm text-muted-foreground">{description}</p>
        <Link href={href}><Button className="w-full">{button}</Button></Link>
      </CardContent>
    </Card>
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
