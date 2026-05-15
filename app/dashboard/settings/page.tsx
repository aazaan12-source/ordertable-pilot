import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getManagerRestaurant } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

async function updateSettings(formData: FormData) {
  "use server";
  const { user, restaurant } = await getManagerRestaurant();
  await db.restaurant.update({
    where: { id: restaurant.id },
    data: {
      name: String(formData.get("name") || ""),
      branchName: String(formData.get("branchName") || ""),
      city: String(formData.get("city") || ""),
      address: String(formData.get("address") || ""),
      phone: String(formData.get("phone") || ""),
      logoUrl: String(formData.get("logoUrl") || "") || null,
      serviceChargePercent: Number(formData.get("serviceChargePercent") || 0),
      taxPercent: Number(formData.get("taxPercent") || 0),
      customerCancelWindowMinutes: Math.max(0, Number(formData.get("customerCancelWindowMinutes") || 3)),
      orderingEnabled: formData.get("orderingEnabled") === "on"
    }
  });
  await db.activityLog.create({ data: { restaurantId: restaurant.id, userId: user.id, action: "restaurant_settings_updated", description: "Restaurant settings updated" } });
  revalidatePath("/dashboard/settings");
  revalidatePath(`/r/${restaurant.slug}/t/1`);
}

export default async function SettingsPage() {
  const { restaurant } = await getManagerRestaurant();
  return (
    <main className="p-4 lg:p-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <Card className="mt-5 max-w-3xl">
        <CardHeader><CardTitle>Restaurant settings</CardTitle></CardHeader>
        <CardContent>
          <form action={updateSettings} className="grid gap-4 md:grid-cols-2">
            <Input name="name" defaultValue={restaurant.name} placeholder="Restaurant name" />
            <Input name="branchName" defaultValue={restaurant.branchName} placeholder="Branch" />
            <Input name="city" defaultValue={restaurant.city} placeholder="City" />
            <Input name="phone" defaultValue={restaurant.phone} placeholder="Phone" />
            <Input className="md:col-span-2" name="address" defaultValue={restaurant.address} placeholder="Address" />
            <Input className="md:col-span-2" name="logoUrl" defaultValue={restaurant.logoUrl || ""} placeholder="Logo URL" />
            <Input name="serviceChargePercent" type="number" defaultValue={restaurant.serviceChargePercent.toString()} placeholder="Service charge %" />
            <Input name="taxPercent" type="number" defaultValue={restaurant.taxPercent.toString()} placeholder="Tax %" />
            <Input name="customerCancelWindowMinutes" type="number" defaultValue={restaurant.customerCancelWindowMinutes} placeholder="Customer cancel window minutes" />
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input type="checkbox" name="orderingEnabled" defaultChecked={restaurant.orderingEnabled} />
              Ordering enabled
            </label>
            <Button className="md:col-span-2">Save settings</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
