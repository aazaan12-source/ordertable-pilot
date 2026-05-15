import Link from "next/link";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/permissions";
import { toggleOrdering, toggleRestaurantStatus } from "@/lib/admin-restaurant-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatPkDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RestaurantsPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; city?: string; status?: string; subscription?: string; ordering?: string }>;
}) {
  await requirePlatformAdmin();
  const filters = await searchParams;
  const restaurants = await db.restaurant.findMany({
    where: {
      ...(filters.q
        ? {
            OR: [
              { name: { contains: filters.q, mode: "insensitive" } },
              { branchName: { contains: filters.q, mode: "insensitive" } },
              { phone: { contains: filters.q, mode: "insensitive" } }
            ]
          }
        : {}),
      ...(filters.city ? { city: filters.city } : {}),
      ...(filters.status ? { status: filters.status as "ACTIVE" | "INACTIVE" } : {}),
      ...(filters.subscription ? { subscriptionStatus: filters.subscription as any } : {}),
      ...(filters.ordering ? { orderingEnabled: filters.ordering === "enabled" } : {})
    },
    include: {
      tables: true,
      menuItems: { select: { id: true } },
      users: { where: { role: "RESTAURANT_MANAGER" }, take: 1 }
    },
    orderBy: { createdAt: "desc" }
  });
  const cities = await db.restaurant.findMany({ distinct: ["city"], select: { city: true }, orderBy: { city: "asc" } });

  return (
    <main className="mx-auto max-w-7xl p-4 lg:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Restaurants</h1>
          <p className="text-sm text-muted-foreground">Add and manage many restaurant accounts, tables, QR codes, menus, managers, and billing status.</p>
        </div>
        <Link href="/admin/restaurants/new"><Button>Add New Restaurant</Button></Link>
      </div>

      <Card className="mb-5">
        <CardContent className="p-4">
          <form className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_auto]">
            <Input name="q" placeholder="Search name, branch, phone" defaultValue={filters.q || ""} />
            <select name="city" defaultValue={filters.city || ""} className="h-10 rounded-md border bg-white px-3 text-sm">
              <option value="">All cities</option>
              {cities.map((item) => <option key={item.city} value={item.city}>{item.city}</option>)}
            </select>
            <select name="status" defaultValue={filters.status || ""} className="h-10 rounded-md border bg-white px-3 text-sm">
              <option value="">All status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            <select name="subscription" defaultValue={filters.subscription || ""} className="h-10 rounded-md border bg-white px-3 text-sm">
              <option value="">All plans</option>
              <option value="PILOT">Pilot</option>
              <option value="STARTER">Starter</option>
              <option value="GROWTH">Growth</option>
              <option value="PRO">Pro</option>
              <option value="EXPIRED">Expired</option>
            </select>
            <select name="ordering" defaultValue={filters.ordering || ""} className="h-10 rounded-md border bg-white px-3 text-sm">
              <option value="">Ordering</option>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
            <Button variant="outline">Filter</Button>
          </form>
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded-lg border bg-white">
        <div className="grid grid-cols-[1.5fr_1fr_0.6fr_0.8fr_1fr_1fr_1.3fr] gap-3 border-b bg-muted px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <span>Restaurant</span>
          <span>Location</span>
          <span>Tables</span>
          <span>Menu</span>
          <span>Manager</span>
          <span>Status</span>
          <span>Actions</span>
        </div>
        {restaurants.map((restaurant) => {
          const activeTables = restaurant.tables.filter((table) => table.status !== "INACTIVE").length;
          const manager = restaurant.users[0];
          return (
            <div key={restaurant.id} className="grid grid-cols-[1.5fr_1fr_0.6fr_0.8fr_1fr_1fr_1.3fr] gap-3 border-b px-4 py-4 text-sm last:border-b-0">
              <div>
                <Link href={`/admin/restaurants/${restaurant.id}`} className="font-bold hover:underline">{restaurant.name}</Link>
                <p className="text-xs text-muted-foreground">{restaurant.branchName} · created {formatPkDateTime(restaurant.createdAt)}</p>
              </div>
              <div>
                <p>{restaurant.city}</p>
                <p className="text-xs text-muted-foreground">{restaurant.phone}</p>
              </div>
              <p>{activeTables}/{restaurant.tables.length}</p>
              <p>{restaurant.menuItems.length} items</p>
              <p className="break-all text-xs">{manager?.email || "Missing"}</p>
              <div className="space-y-1">
                <Badge className={restaurant.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-700"}>{restaurant.status}</Badge>
                <Badge className={restaurant.orderingEnabled ? "bg-blue-100 text-blue-800" : "bg-orange-100 text-orange-800"}>{restaurant.orderingEnabled ? "Ordering On" : "Ordering Off"}</Badge>
                <Badge className="bg-muted text-foreground">{restaurant.subscriptionStatus}</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/admin/restaurants/${restaurant.id}`}><Button size="sm" variant="outline">View</Button></Link>
                <Link href={`/admin/restaurants/${restaurant.id}/edit`}><Button size="sm" variant="outline">Edit</Button></Link>
                <Link href={`/admin/restaurants/${restaurant.id}/tables`}><Button size="sm" variant="outline">Tables</Button></Link>
                <Link href={`/admin/restaurants/${restaurant.id}/qr-codes`}><Button size="sm" variant="outline">QR</Button></Link>
                <Link href={`/admin/restaurants/${restaurant.id}/menu/items`}><Button size="sm" variant="outline">Menu</Button></Link>
                <Link href={`/admin/restaurants/${restaurant.id}/manager`}><Button size="sm" variant="outline">Manager</Button></Link>
                <Link href={`/admin/restaurants/${restaurant.id}/orders`}><Button size="sm" variant="outline">Orders</Button></Link>
                <Link href={`/admin/restaurants/${restaurant.id}/reports`}><Button size="sm" variant="outline">Reports</Button></Link>
                <form action={toggleRestaurantStatus}>
                  <input type="hidden" name="id" value={restaurant.id} />
                  <input type="hidden" name="status" value={restaurant.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"} />
                  <Button size="sm" variant={restaurant.status === "ACTIVE" ? "destructive" : "secondary"}>{restaurant.status === "ACTIVE" ? "Deactivate" : "Activate"}</Button>
                </form>
                <form action={toggleOrdering}>
                  <input type="hidden" name="id" value={restaurant.id} />
                  <input type="hidden" name="orderingEnabled" value={String(!restaurant.orderingEnabled)} />
                  <Button size="sm" variant="outline">{restaurant.orderingEnabled ? "Disable Ordering" : "Enable Ordering"}</Button>
                </form>
              </div>
            </div>
          );
        })}
      </div>
      {restaurants.length === 0 ? <p className="mt-5 rounded-lg border bg-white p-6 text-center text-muted-foreground">No restaurants match this filter.</p> : null}
    </main>
  );
}
