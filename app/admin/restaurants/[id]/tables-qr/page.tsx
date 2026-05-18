import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/permissions";
import { regenerateRestaurantQRCodes, updateRestaurantTableCount, updateSingleTable } from "@/lib/admin-restaurant-actions";
import { AdminBreadcrumbs } from "@/components/admin/admin-breadcrumbs";
import { PrintPageButton } from "@/components/admin/print-page-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { QrCard } from "@/components/dashboard/qr-card";

export const dynamic = "force-dynamic";

function tableErrorMessage(error?: string, tableNumber?: string) {
  if (error === "duplicate-table") return `Table ${tableNumber || ""} already exists for this restaurant. Use a unique table number.`;
  if (error === "table-not-found") return "That table record could not be found. Refresh and try again.";
  if (error === "invalid-range") return "The last table number must be the same as or higher than the first table number.";
  if (error === "table-sync-failed") return "Could not update the table QR range. Please check the first and last table numbers and try again.";
  if (error === "table-update-failed") return "Could not save this table. Please try again.";
  return null;
}

export default async function AdminTablesQrPage({
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
  const inactiveTables = restaurant.tables.filter((table) => table.status === "INACTIVE");
  const firstActiveTableNumber = activeTables[0]?.tableNumber || 1;
  const lastActiveTableNumber = activeTables[activeTables.length - 1]?.tableNumber || activeTables.length || 20;
  const defaultLastTableNumber = Math.max(lastActiveTableNumber, 1);
  const baseUrl = (process.env.APP_URL || process.env.NEXTAUTH_URL || "").replace(/\/$/, "");

  return (
    <main className="mx-auto max-w-7xl p-4 lg:p-6">
      <AdminBreadcrumbs items={[{ label: "Restaurants", href: "/admin/restaurants" }, { label: restaurant.name, href: `/admin/restaurants/${restaurant.id}` }, { label: "Tables & QR Codes" }]} />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tables & QR Codes</h1>
          <p className="text-sm text-muted-foreground">Manage table count and generate QR codes for {restaurant.name} - {restaurant.branchName}.</p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <PrintPageButton />
          <form action={regenerateRestaurantQRCodes}>
            <input type="hidden" name="restaurantId" value={restaurant.id} />
            <Button variant="outline">Regenerate QR URLs</Button>
          </form>
        </div>
      </div>

      {errorMessage ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{errorMessage}</div> : null}
      {saved ? <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-800">Table and QR settings saved successfully.</div> : null}

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Stat title="Active Tables" value={activeTables.length} />
        <Stat title="Inactive Tables" value={inactiveTables.length} />
        <Stat title="QR Range" value={activeTables.length ? `${firstActiveTableNumber}-${lastActiveTableNumber}` : "None"} />
      </div>

      <Card className="mb-5 print:hidden">
        <CardHeader>
          <CardTitle>Change Table Range</CardTitle>
          <p className="text-sm text-muted-foreground">Enter the first table number on the left and the last table number on the right. Increasing creates missing table QR codes. Reducing hides old active table QR records when they have order history.</p>
        </CardHeader>
        <CardContent>
          <form action={updateRestaurantTableCount} className="grid gap-3 md:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_auto]">
            <input type="hidden" name="restaurantId" value={restaurant.id} />
            <label className="grid gap-1 text-sm font-medium">
              First table number
              <Input name="firstTableNumber" type="number" min={1} max={500} defaultValue={1} placeholder="Start from table 1" required />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Last table number
              <Input name="lastTableNumber" type="number" min={1} max={500} defaultValue={defaultLastTableNumber} placeholder="Last table, e.g. 20" required />
            </label>
            <div className="flex items-end">
              <Button className="w-full md:w-auto">Save Table Range</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <section className="print:hidden">
          <div className="mb-3">
            <h2 className="text-lg font-bold">Active Tables</h2>
            <p className="text-sm text-muted-foreground">Edit individual table numbers or status when needed.</p>
          </div>
          <div className="grid gap-3">
            {activeTables.map((table) => (
              <Card key={table.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle>Table {table.tableNumber}</CardTitle>
                    <StatusBadge status={table.status} />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="break-all text-xs text-muted-foreground">{table.qrUrl}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{table._count.orders} previous orders</p>
                  <form action={updateSingleTable} className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto] xl:grid-cols-1">
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
            {activeTables.length === 0 ? (
              <div className="rounded-lg border bg-white p-6 text-center">
                <p className="font-semibold">No tables created yet.</p>
                <p className="mt-1 text-sm text-muted-foreground">Use the table range form to create table QR codes.</p>
              </div>
            ) : null}
          </div>
        </section>

        <section>
          <div className="mb-3 print:hidden">
            <h2 className="text-lg font-bold">QR Grid</h2>
            <p className="text-sm text-muted-foreground">Copy QR URLs, download PNG signs, or print the full grid.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2">
            {activeTables.map((table) => (
              <div key={table.id} className="break-inside-avoid">
                <QrCard tableNumber={table.tableNumber} url={table.qrUrl} baseUrl={baseUrl} restaurantName={restaurant.name} />
              </div>
            ))}
          </div>
        </section>
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

