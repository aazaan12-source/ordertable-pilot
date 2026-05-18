import Link from "next/link";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/permissions";
import { deleteRestaurantCompletely, toggleOrdering, toggleRestaurantStatus } from "@/lib/admin-restaurant-actions";
import { AdminBreadcrumbs } from "@/components/admin/admin-breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { formatPkDateTime } from "@/lib/utils";
import { MoreVertical } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function RestaurantsPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; city?: string; status?: string; subscription?: string; ordering?: string; deleted?: string }>;
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
    <main className="mx-auto max-w-7xl p-3 sm:p-4 lg:p-6">
      <AdminBreadcrumbs items={[{ label: "Restaurants" }]} />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Restaurants</h1>
          <p className="text-sm text-muted-foreground">Manage all restaurants connected to OrderTable. Open a restaurant first, then manage its profile, tables, QR codes, menu, login, orders, and reports.</p>
        </div>
        <Link href="/admin/restaurants/new"><Button className="w-full sm:w-auto">Add Restaurant</Button></Link>
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

      {filters.deleted ? (
        <div className="mb-5 rounded-md border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-800">
          Restaurant deleted successfully.
        </div>
      ) : null}

      <div className="grid gap-3 lg:hidden">
        {restaurants.map((restaurant) => {
          const activeTables = restaurant.tables.filter((table) => table.status !== "INACTIVE").length;
          const manager = restaurant.users[0];
          return (
            <Card key={restaurant.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/admin/restaurants/${restaurant.id}`} className="break-words text-base font-bold hover:underline">{restaurant.name}</Link>
                    <p className="mt-1 text-xs text-muted-foreground">{restaurant.branchName} - {restaurant.city}</p>
                    <p className="text-xs text-muted-foreground">Created {formatPkDateTime(restaurant.createdAt)}</p>
                  </div>
                  <RestaurantActions restaurant={restaurant} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <p className="rounded-md bg-muted p-2"><strong>{activeTables}/{restaurant.tables.length}</strong><br /><span className="text-xs text-muted-foreground">Tables</span></p>
                  <p className="rounded-md bg-muted p-2"><strong>{restaurant.menuItems.length}</strong><br /><span className="text-xs text-muted-foreground">Menu items</span></p>
                </div>
                <p className="mt-3 break-all text-xs text-muted-foreground">Manager: {manager?.email || "Missing"}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge className={restaurant.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-700"}>{restaurant.status}</Badge>
                  <Badge className={restaurant.orderingEnabled ? "bg-blue-100 text-blue-800" : "bg-orange-100 text-orange-800"}>{restaurant.orderingEnabled ? "Ordering On" : "Ordering Off"}</Badge>
                  <Badge className="bg-muted text-foreground">{restaurant.subscriptionStatus}</Badge>
                </div>
                <div className="mt-4">
                  <Link href={`/admin/restaurants/${restaurant.id}`}><Button className="w-full">Manage</Button></Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="hidden overflow-hidden rounded-lg border bg-white lg:block">
        <div className="grid grid-cols-[1.45fr_1fr_0.75fr_1.1fr_0.85fr_0.9fr] gap-3 border-b bg-muted px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <span>Restaurant</span>
          <span>Branch / City</span>
          <span>Tables</span>
          <span>Manager Email</span>
          <span>Status</span>
          <span>Actions</span>
        </div>
        {restaurants.map((restaurant) => {
          const activeTables = restaurant.tables.filter((table) => table.status !== "INACTIVE").length;
          const manager = restaurant.users[0];
          return (
            <div key={restaurant.id} className="grid grid-cols-[1.45fr_1fr_0.75fr_1.1fr_0.85fr_0.9fr] items-center gap-3 border-b px-4 py-4 text-sm last:border-b-0">
              <div className="min-w-0">
                <Link href={`/admin/restaurants/${restaurant.id}`} className="font-bold hover:underline">{restaurant.name}</Link>
                <p className="text-xs text-muted-foreground">Created {formatPkDateTime(restaurant.createdAt)}</p>
              </div>
              <div>
                <p>{restaurant.branchName}</p>
                <p className="text-xs text-muted-foreground">{restaurant.city}</p>
              </div>
              <p>{activeTables}/{restaurant.tables.length}</p>
              <p className="break-all text-xs">{manager?.email || "Missing"}</p>
              <div className="flex flex-wrap gap-1">
                <Badge className={restaurant.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-700"}>{restaurant.status}</Badge>
                <Badge className={restaurant.orderingEnabled ? "bg-blue-100 text-blue-800" : "bg-orange-100 text-orange-800"}>{restaurant.orderingEnabled ? "Ordering On" : "Ordering Off"}</Badge>
                <Badge className="bg-muted text-foreground">{restaurant.subscriptionStatus}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Link href={`/admin/restaurants/${restaurant.id}`}><Button size="sm">Manage</Button></Link>
                <RestaurantActions restaurant={restaurant} />
              </div>
            </div>
          );
        })}
      </div>
      {restaurants.length === 0 ? (
        <div className="mt-5 rounded-lg border bg-white p-8 text-center">
          <p className="font-semibold">No restaurants added yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">Create the first restaurant account to start generating tables, QR codes, menus, and manager login.</p>
          <Link href="/admin/restaurants/new" className="mt-4 inline-block"><Button>Add First Restaurant</Button></Link>
        </div>
      ) : null}
    </main>
  );
}

function RestaurantActions({ restaurant }: { restaurant: any }) {
  return (
    <details className="relative">
      <summary className="flex h-9 w-9 list-none items-center justify-center rounded-md border bg-white text-muted-foreground hover:bg-muted [&::-webkit-details-marker]:hidden" aria-label={`Actions for ${restaurant.name}`}>
        <MoreVertical className="h-4 w-4" />
      </summary>
      <div className="absolute right-0 top-10 z-20 w-56 rounded-md border bg-white p-2 text-sm shadow-lg">
        <Link href={`/admin/restaurants/${restaurant.id}/edit`} className="block rounded px-3 py-2 hover:bg-muted">Edit Profile</Link>
        <Link href={`/admin/restaurants/${restaurant.id}/orders`} className="block rounded px-3 py-2 hover:bg-muted">View Orders</Link>
        <Link href={`/admin/restaurants/${restaurant.id}/reports`} className="block rounded px-3 py-2 hover:bg-muted">View Reports</Link>
        <div className="my-1 border-t" />
        <form action={toggleOrdering}>
          <input type="hidden" name="id" value={restaurant.id} />
          <input type="hidden" name="orderingEnabled" value={String(!restaurant.orderingEnabled)} />
          <ConfirmSubmitButton
            className="w-full justify-start"
            size="sm"
            variant="ghost"
            message={restaurant.orderingEnabled ? `Disable online ordering for ${restaurant.name}? Customers will not be able to place QR orders until it is enabled again.` : `Enable online ordering for ${restaurant.name}?`}
            pendingText="Saving..."
          >
            {restaurant.orderingEnabled ? "Disable Ordering" : "Enable Ordering"}
          </ConfirmSubmitButton>
        </form>
        <form action={toggleRestaurantStatus}>
          <input type="hidden" name="id" value={restaurant.id} />
          <input type="hidden" name="status" value={restaurant.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"} />
          <ConfirmSubmitButton
            className="w-full justify-start"
            size="sm"
            variant={restaurant.status === "ACTIVE" ? "ghost" : "ghost"}
            message={restaurant.status === "ACTIVE" ? `Deactivate ${restaurant.name}? Existing records remain saved, but the restaurant will be marked inactive.` : `Activate ${restaurant.name}?`}
            pendingText="Saving..."
          >
            {restaurant.status === "ACTIVE" ? "Deactivate" : "Activate"}
          </ConfirmSubmitButton>
        </form>
        {restaurant.status === "INACTIVE" ? (
          <form action={deleteRestaurantCompletely} className="mt-1">
            <input type="hidden" name="restaurantId" value={restaurant.id} />
            <input type="hidden" name="confirmation" value={restaurant.slug} />
            <ConfirmSubmitButton
              className="w-full justify-start text-red-700 hover:bg-red-50"
              size="sm"
              variant="ghost"
              message={`Permanent delete warning:\n\nThis will delete ${restaurant.name} completely, including manager logins, tables, QR codes, menu, orders, bills, reports, waiter requests, feedback, and restaurant records.\n\nThis cannot be undone.`}
              pendingText="Deleting..."
            >
              Delete Permanently
            </ConfirmSubmitButton>
          </form>
        ) : null}
      </div>
    </details>
  );
}
