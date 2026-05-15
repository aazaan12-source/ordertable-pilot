import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/permissions";
import { updateRestaurantTableCount, updateSingleTable } from "@/lib/admin-restaurant-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/dashboard/status-badge";

export const dynamic = "force-dynamic";

export default async function AdminTablesPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdmin();
  const { id } = await params;
  const restaurant = await db.restaurant.findUnique({
    where: { id },
    include: { tables: { include: { _count: { select: { orders: true } } }, orderBy: { tableNumber: "asc" } } }
  });
  if (!restaurant) notFound();
  const activeCount = restaurant.tables.filter((table) => table.status !== "INACTIVE").length;

  return (
    <main className="mx-auto max-w-7xl p-4 lg:p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Manage Tables</h1>
        <p className="text-sm text-muted-foreground">Managing tables for: <strong>{restaurant.name} - {restaurant.branchName}</strong></p>
      </div>

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Bulk table count</CardTitle>
          <p className="text-sm text-muted-foreground">Increasing table count creates missing tables. Reducing table count deactivates extra tables and keeps past order history.</p>
        </CardHeader>
        <CardContent>
          <form action={updateRestaurantTableCount} className="grid gap-3 md:grid-cols-[180px_180px_auto]">
            <input type="hidden" name="restaurantId" value={restaurant.id} />
            <Input name="tableCount" type="number" min={1} max={500} defaultValue={activeCount || restaurant.tables.length || 10} />
            <Input name="startingTableNumber" type="number" min={1} defaultValue={1} />
            <Button>Update Table Count</Button>
          </form>
          <p className="mt-3 rounded-md border border-orange-300 bg-orange-50 p-3 text-sm text-orange-950">
            Reducing table count will deactivate extra tables but will not delete past order history.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {restaurant.tables.map((table) => (
          <Card key={table.id} className={table.status === "INACTIVE" ? "opacity-60" : ""}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Table {table.tableNumber}</CardTitle>
                <StatusBadge status={table.status} />
              </div>
            </CardHeader>
            <CardContent>
              <p className="break-all text-xs text-muted-foreground">{table.qrUrl}</p>
              <p className="mt-2 text-xs text-muted-foreground">{table._count.orders} previous orders</p>
              <form action={updateSingleTable} className="mt-4 grid gap-2">
                <input type="hidden" name="restaurantId" value={restaurant.id} />
                <input type="hidden" name="tableId" value={table.id} />
                <Input name="tableNumber" type="number" defaultValue={table.tableNumber} />
                <select name="status" defaultValue={table.status} className="h-10 rounded-md border bg-white px-3 text-sm">
                  <option value="EMPTY">Empty / Active</option>
                  <option value="ACTIVE_ORDER">Active Order</option>
                  <option value="PREPARING">Preparing</option>
                  <option value="SERVED">Served</option>
                  <option value="BILL_REQUESTED">Bill Requested</option>
                  <option value="PAID">Paid</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
                <Button variant="outline">Save Table</Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
