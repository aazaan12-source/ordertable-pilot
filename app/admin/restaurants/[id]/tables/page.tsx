import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/permissions";
import { updateRestaurantTableCount, updateSingleTable } from "@/lib/admin-restaurant-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/dashboard/status-badge";

export const dynamic = "force-dynamic";

function tableErrorMessage(error?: string, tableNumber?: string) {
  if (error === "duplicate-table") return `Table ${tableNumber || ""} already exists for this restaurant. Use a unique table number.`;
  if (error === "table-not-found") return "That table record could not be found. Refresh and try again.";
  if (error === "invalid-range") return "The last table number must be the same as or higher than the first table number.";
  if (error === "table-sync-failed") return "Could not update the table QR range. Please check the first and last table numbers and try again.";
  if (error === "table-update-failed") return "Could not save this table. Please try again.";
  return null;
}

export default async function AdminTablesPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; tableNumber?: string }>;
}) {
  await requirePlatformAdmin();
  const { id } = await params;
  const { error, saved, tableNumber } = await searchParams;
  const errorMessage = tableErrorMessage(error, tableNumber);
  const restaurant = await db.restaurant.findUnique({
    where: { id },
    include: { tables: { include: { _count: { select: { orders: true } } }, orderBy: { tableNumber: "asc" } } }
  });
  if (!restaurant) notFound();
  const activeTables = restaurant.tables.filter((table) => table.status !== "INACTIVE");
  const activeCount = activeTables.length;
  const archivedCount = restaurant.tables.length - activeCount;
  const firstActiveTableNumber = activeTables[0]?.tableNumber || 1;
  const lastActiveTableNumber = activeTables[activeTables.length - 1]?.tableNumber || activeCount || 20;
  const defaultFirstTableNumber = 1;
  const defaultLastTableNumber = Math.max(lastActiveTableNumber, defaultFirstTableNumber);

  return (
    <main className="mx-auto max-w-7xl p-4 lg:p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Manage Tables</h1>
        <p className="text-sm text-muted-foreground">Managing tables for: <strong>{restaurant.name} - {restaurant.branchName}</strong></p>
      </div>
      {errorMessage ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {errorMessage}
        </div>
      ) : null}
      {saved ? (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-800">
          Table settings saved successfully.
        </div>
      ) : null}

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Table QR Range</CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter the first table number on the left and the last table number on the right. For example, 1 to 20 creates QR codes for tables 1 through 20.
          </p>
        </CardHeader>
        <CardContent>
          <form action={updateRestaurantTableCount} className="grid gap-3 md:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_auto]">
            <input type="hidden" name="restaurantId" value={restaurant.id} />
            <label className="grid gap-1 text-sm font-medium">
              First table number
              <Input
                name="firstTableNumber"
                type="number"
                min={1}
                max={500}
                defaultValue={defaultFirstTableNumber}
                placeholder="Start from table 1"
                required
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Last table number
              <Input
                name="lastTableNumber"
                type="number"
                min={1}
                max={500}
                defaultValue={defaultLastTableNumber}
                placeholder="Last table, e.g. 20"
                required
              />
            </label>
            <div className="flex items-end">
              <Button className="w-full md:w-auto">Save Table Range</Button>
            </div>
          </form>
          <p className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
            Current active QR range: Table {firstActiveTableNumber} to Table {lastActiveTableNumber} ({activeCount} QR code{activeCount === 1 ? "" : "s"}).
          </p>
          <p className="mt-3 rounded-md border border-orange-300 bg-orange-50 p-3 text-sm text-orange-950">
            Reducing the last table number removes extra QR codes from the restaurant dashboard. Past order history is still protected.
            {archivedCount > 0 ? ` ${archivedCount} old table record${archivedCount === 1 ? " is" : "s are"} archived for history and hidden from QR lists.` : ""}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {activeTables.map((table) => (
          <Card key={table.id}>
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
                <Input name="tableNumber" type="number" min={1} max={500} defaultValue={table.tableNumber} placeholder="Table number, e.g. 1" />
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
