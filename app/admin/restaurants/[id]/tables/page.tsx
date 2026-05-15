import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/permissions";
import { tableQrUrl } from "@/lib/qr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/dashboard/status-badge";

async function createTables(formData: FormData) {
  "use server";
  await requirePlatformAdmin();
  const restaurantId = String(formData.get("restaurantId"));
  const count = Number(formData.get("count") || 0);
  const restaurant = await db.restaurant.findUnique({ where: { id: restaurantId }, include: { tables: true } });
  if (!restaurant) return;
  const existing = new Set(restaurant.tables.map((table) => table.tableNumber));
  for (let tableNumber = 1; tableNumber <= count; tableNumber++) {
    if (!existing.has(tableNumber)) {
      await db.restaurantTable.create({ data: { restaurantId, tableNumber, qrUrl: tableQrUrl(restaurant.slug, tableNumber) } });
    }
  }
  revalidatePath(`/admin/restaurants/${restaurantId}/tables`);
}

export default async function AdminTablesPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdmin();
  const { id } = await params;
  const restaurant = await db.restaurant.findUnique({ where: { id }, include: { tables: { orderBy: { tableNumber: "asc" } } } });
  if (!restaurant) notFound();
  return (
    <main className="mx-auto max-w-6xl p-4 lg:p-6">
      <h1 className="text-2xl font-bold">{restaurant.name} Tables</h1>
      <form action={createTables} className="my-5 flex max-w-sm gap-2">
        <input type="hidden" name="restaurantId" value={restaurant.id} />
        <Input name="count" type="number" defaultValue={20} />
        <Button>Ensure Tables</Button>
      </form>
      <div className="grid gap-4 md:grid-cols-4">
        {restaurant.tables.map((table) => (
          <Card key={table.id}>
            <CardHeader><CardTitle>Table {table.tableNumber}</CardTitle></CardHeader>
            <CardContent>
              <StatusBadge status={table.status} />
              <p className="mt-3 break-all text-xs text-muted-foreground">{table.qrUrl}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
