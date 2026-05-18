import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/permissions";
import { createOrUpdateRestaurantManager } from "@/lib/admin-restaurant-actions";
import { AdminBreadcrumbs } from "@/components/admin/admin-breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { formatPkDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminRestaurantManagerPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdmin();
  const { id } = await params;
  const restaurant = await db.restaurant.findUnique({
    where: { id },
    include: { users: { where: { role: "RESTAURANT_MANAGER" }, orderBy: { createdAt: "asc" } } }
  });
  if (!restaurant) notFound();
  const manager = restaurant.users[0];

  return (
    <main className="mx-auto max-w-4xl p-4 lg:p-6">
      <AdminBreadcrumbs items={[{ label: "Restaurants", href: "/admin/restaurants" }, { label: restaurant.name, href: `/admin/restaurants/${restaurant.id}` }, { label: "Manager Login" }]} />
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Manager Login</h1>
        <p className="text-sm text-muted-foreground">Create, update, activate, or reset the restaurant manager login for <strong>{restaurant.name} - {restaurant.branchName}</strong>.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{manager ? "Update Manager" : "Create Manager Login"}</CardTitle>
          <p className="text-sm text-muted-foreground">Password is only changed when you enter a new temporary password.</p>
        </CardHeader>
        <CardContent>
          <form action={createOrUpdateRestaurantManager} className="grid gap-3 md:grid-cols-2">
            <input type="hidden" name="restaurantId" value={restaurant.id} />
            <input type="hidden" name="id" value={manager?.id || ""} />
            <Input name="name" placeholder="Manager name" defaultValue={manager?.name || ""} required />
            <Input name="email" type="email" placeholder="Manager email" defaultValue={manager?.email || ""} required />
            <Input name="phone" placeholder="Phone optional" defaultValue={manager?.phone || ""} />
            <PasswordInput name="password" placeholder={manager ? "New temporary password optional" : "Temporary password"} defaultValue={manager ? "" : "Manager12345"} required={!manager} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={manager?.isActive ?? true} /> Manager login active</label>
            <div className="text-sm text-muted-foreground">
              Last login: <strong>{manager?.lastLoginAt ? formatPkDateTime(manager.lastLoginAt) : "Not recorded yet"}</strong>
            </div>
            <ConfirmSubmitButton
              className="md:col-span-2"
              size="md"
              variant="default"
              message={manager ? "Save manager login changes? If you entered a new temporary password, the manager password will be reset." : "Create this restaurant manager login?"}
              pendingText="Saving manager..."
            >
              {manager ? "Save Manager" : "Create Manager"}
            </ConfirmSubmitButton>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
