import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/permissions";
import { updateRestaurantDetails } from "@/lib/admin-restaurant-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/confirm-submit-button";

export const dynamic = "force-dynamic";

function dateValue(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "";
}

export default async function AdminRestaurantEditPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  await requirePlatformAdmin();
  const { id } = await params;
  const { saved } = await searchParams;
  const restaurant = await db.restaurant.findUnique({
    where: { id },
    include: { tables: { orderBy: { tableNumber: "asc" } } }
  });
  if (!restaurant) notFound();
  const activeTables = restaurant.tables.filter((table) => table.status !== "INACTIVE");
  const defaultTableCount = activeTables.length || restaurant.tables.length || 1;
  const defaultStartingTableNumber = activeTables[0]?.tableNumber || restaurant.tables[0]?.tableNumber || 1;

  return (
    <main className="mx-auto max-w-4xl p-4 lg:p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Edit Restaurant</h1>
        <p className="text-sm text-muted-foreground">Changing the slug can affect existing printed QR codes. QR records will be regenerated to the latest slug.</p>
      </div>
      {saved ? (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-800">
          Restaurant settings saved successfully.
        </div>
      ) : null}
      <Card>
        <CardHeader><CardTitle>{restaurant.name}</CardTitle></CardHeader>
        <CardContent>
          <form action={updateRestaurantDetails} className="grid gap-3 md:grid-cols-2">
            <input type="hidden" name="id" value={restaurant.id} />
            <Input name="name" defaultValue={restaurant.name} required />
            <Input name="slug" defaultValue={restaurant.slug} required />
            <Input name="branchName" defaultValue={restaurant.branchName} required />
            <Input name="city" defaultValue={restaurant.city} required />
            <Input name="phone" defaultValue={restaurant.phone} />
            <Input name="logoUrl" defaultValue={restaurant.logoUrl || ""} placeholder="Logo URL" />
            <Input className="md:col-span-2" name="address" defaultValue={restaurant.address} />
            <select name="status" defaultValue={restaurant.status} className="h-10 rounded-md border bg-white px-3 text-sm">
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            <select name="subscriptionStatus" defaultValue={restaurant.subscriptionStatus} className="h-10 rounded-md border bg-white px-3 text-sm">
              <option value="PILOT">Pilot</option>
              <option value="STARTER">Starter</option>
              <option value="GROWTH">Growth</option>
              <option value="PRO">Pro</option>
              <option value="EXPIRED">Expired</option>
            </select>
            <Input name="pilotStartDate" type="date" defaultValue={dateValue(restaurant.pilotStartDate)} />
            <Input name="pilotEndDate" type="date" defaultValue={dateValue(restaurant.pilotEndDate)} />
            <Input name="serviceChargePercent" type="number" defaultValue={restaurant.serviceChargePercent.toString()} />
            <Input name="taxPercent" type="number" defaultValue={restaurant.taxPercent.toString()} />
            <Input name="customerCancelWindowMinutes" type="number" defaultValue={restaurant.customerCancelWindowMinutes} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="orderingEnabled" defaultChecked={restaurant.orderingEnabled} /> Ordering enabled</label>
            <div className="rounded-md border bg-white p-3 md:col-span-2">
              <p className="mb-2 text-sm font-bold">Tables and QR Codes</p>
              <p className="mb-3 text-xs text-muted-foreground">
                Increasing creates only the missing table QR codes. Reducing removes unused extra QR records; tables with old order history are archived and hidden from QR lists.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input name="tableCount" type="number" min={1} max={500} defaultValue={defaultTableCount} placeholder="Number of active tables" />
                <Input name="startingTableNumber" type="number" min={1} defaultValue={defaultStartingTableNumber} placeholder="Starting table number" />
              </div>
            </div>
            <div className="rounded-md border bg-white p-3 md:col-span-2">
              <p className="mb-2 text-sm font-bold">Menu Setup</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="rounded-md border p-3 text-sm">
                  <input type="radio" name="menuSetup" value="keep" defaultChecked /> Keep current menu
                  <span className="mt-1 block text-xs text-muted-foreground">No menu changes.</span>
                </label>
                <label className="rounded-md border p-3 text-sm">
                  <input type="radio" name="menuSetup" value="empty" /> No menu / clear menu
                  <span className="mt-1 block text-xs text-muted-foreground">Deletes categories and menu items.</span>
                </label>
                <label className="rounded-md border p-3 text-sm">
                  <input type="radio" name="menuSetup" value="sample" /> Add sample menu
                  <span className="mt-1 block text-xs text-muted-foreground">Adds sample menu only if menu is empty.</span>
                </label>
              </div>
            </div>
            <div className="rounded-md border border-orange-300 bg-orange-50 p-3 text-sm text-orange-950 md:col-span-2">
              Warning: confirm before changing slug on restaurants with already printed QR codes.
            </div>
            <SubmitButton className="md:col-span-2" pendingText="Saving restaurant...">Save Changes</SubmitButton>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
