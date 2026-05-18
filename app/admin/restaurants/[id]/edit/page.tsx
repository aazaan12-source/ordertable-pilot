import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/permissions";
import { updateRestaurantDetails } from "@/lib/admin-restaurant-actions";
import { AdminBreadcrumbs } from "@/components/admin/admin-breadcrumbs";
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
  const restaurant = await db.restaurant.findUnique({ where: { id } });
  if (!restaurant) notFound();

  return (
    <main className="mx-auto max-w-4xl p-4 lg:p-6">
      <AdminBreadcrumbs items={[{ label: "Restaurants", href: "/admin/restaurants" }, { label: restaurant.name, href: `/admin/restaurants/${restaurant.id}` }, { label: "Restaurant Profile" }]} />
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Restaurant Profile</h1>
        <p className="text-sm text-muted-foreground">Edit name, location, phone, status, ordering settings, and billing configuration. Changing the slug can affect existing printed QR codes.</p>
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
            <Input name="name" defaultValue={restaurant.name} placeholder="Restaurant name" required />
            <Input name="slug" defaultValue={restaurant.slug} placeholder="URL slug, e.g. savour-blue-area" required />
            <Input name="branchName" defaultValue={restaurant.branchName} placeholder="Branch name" required />
            <Input name="city" defaultValue={restaurant.city} placeholder="City" required />
            <Input name="phone" defaultValue={restaurant.phone} placeholder="Restaurant phone number" />
            <Input name="logoUrl" defaultValue={restaurant.logoUrl || ""} placeholder="Logo URL" />
            <Input className="md:col-span-2" name="address" defaultValue={restaurant.address} placeholder="Full restaurant address" />
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
            <Input name="pilotStartDate" type="date" defaultValue={dateValue(restaurant.pilotStartDate)} placeholder="Pilot start date" />
            <Input name="pilotEndDate" type="date" defaultValue={dateValue(restaurant.pilotEndDate)} placeholder="Pilot end date" />
            <Input name="serviceChargePercent" type="number" defaultValue={restaurant.serviceChargePercent.toString()} placeholder="Service charge percent" />
            <Input name="taxPercent" type="number" defaultValue={restaurant.taxPercent.toString()} placeholder="Tax percent" />
            <Input name="customerCancelWindowMinutes" type="number" defaultValue={restaurant.customerCancelWindowMinutes} placeholder="Customer cancel window in minutes" />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="orderingEnabled" defaultChecked={restaurant.orderingEnabled} /> Ordering enabled</label>
            <div className="rounded-md border border-orange-300 bg-orange-50 p-3 text-sm text-orange-950 md:col-span-2">
              Warning: confirm before changing slug on restaurants with already printed QR codes. Manage table QR counts from the Tables & QR Codes page and menu setup from Menu Management.
            </div>
            <SubmitButton className="md:col-span-2" pendingText="Saving restaurant...">Save Changes</SubmitButton>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
