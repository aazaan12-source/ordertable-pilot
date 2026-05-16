import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/permissions";
import { createRestaurantMenuItem, deleteRestaurantMenuItem, updateRestaurantMenuItem } from "@/lib/admin-restaurant-actions";
import { ConfirmSubmitButton, SubmitButton } from "@/components/ui/confirm-submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";
import { menuImageFor } from "@/lib/menu-images";

export const dynamic = "force-dynamic";

export default async function AdminRestaurantMenuItemsPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdmin();
  const { id } = await params;
  const restaurant = await db.restaurant.findUnique({
    where: { id },
    include: {
      categories: { orderBy: { sortOrder: "asc" } },
      menuItems: { include: { category: true }, orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }] }
    }
  });
  if (!restaurant) notFound();
  const activeCategories = restaurant.categories.filter((category) => category.isActive);

  return (
    <main className="mx-auto max-w-7xl p-4 lg:p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Menu Items</h1>
        <p className="text-sm text-muted-foreground">Managing menu for: <strong>{restaurant.name} - {restaurant.branchName}</strong></p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[390px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Add Item</CardTitle>
            <p className="text-sm text-muted-foreground">Add real food photo URLs from restaurant images, Cloudinary, or a public image host.</p>
          </CardHeader>
          <CardContent>
            <form action={createRestaurantMenuItem} className="space-y-3">
              <input type="hidden" name="restaurantId" value={restaurant.id} />
              <Input name="name" placeholder="Item name" required />
              <select name="categoryId" className="h-10 w-full rounded-md border bg-white px-3 text-sm" required>
                {activeCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input name="price" type="number" min={1} placeholder="Price" required />
                <Input name="sortOrder" type="number" defaultValue={1} />
              </div>
              <Input name="imageUrl" placeholder="Food image URL" />
              <Textarea name="description" placeholder="Short description" />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isAvailable" defaultChecked /> Available now</label>
              <SubmitButton className="w-full" pendingText="Adding item...">Add Item</SubmitButton>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          {restaurant.menuItems.map((item) => (
            <Card key={item.id} className={!item.isActive ? "opacity-60" : ""}>
              <CardContent className="grid gap-4 p-4 lg:grid-cols-[180px_1fr]">
                <img src={menuImageFor(item.name, item.category.name, item.imageUrl)} alt={item.name} className="h-40 w-full rounded-md object-cover" />
                <div>
                  <form action={updateRestaurantMenuItem} className="space-y-3">
                    <input type="hidden" name="restaurantId" value={restaurant.id} />
                    <input type="hidden" name="id" value={item.id} />
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input name="name" defaultValue={item.name} required />
                      <select name="categoryId" defaultValue={item.categoryId} className="h-10 rounded-md border bg-white px-3 text-sm">
                        {restaurant.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                      </select>
                      <Input name="price" type="number" defaultValue={item.price.toString()} required />
                      <Input name="sortOrder" type="number" defaultValue={item.sortOrder} />
                      <Input className="md:col-span-2" name="imageUrl" defaultValue={item.imageUrl || ""} placeholder="Food image URL" />
                    </div>
                    <Textarea name="description" defaultValue={item.description} />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap gap-4 text-sm">
                        <label className="flex items-center gap-2"><input type="checkbox" name="isAvailable" defaultChecked={item.isAvailable} /> Available</label>
                        <label className="flex items-center gap-2"><input type="checkbox" name="isActive" defaultChecked={item.isActive} /> Active</label>
                      </div>
                      <SubmitButton pendingText="Saving...">Save</SubmitButton>
                    </div>
                  </form>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-sm text-muted-foreground">
                    <p>{item.category.name} · {formatCurrency(item.price.toString())}</p>
                    <form action={deleteRestaurantMenuItem}>
                      <input type="hidden" name="restaurantId" value={restaurant.id} />
                      <input type="hidden" name="id" value={item.id} />
                      <ConfirmSubmitButton message="Delete this menu item?" pendingText="Deleting...">Delete</ConfirmSubmitButton>
                    </form>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {restaurant.menuItems.length === 0 ? <p className="rounded-lg border bg-white p-6 text-center text-muted-foreground">No menu items yet.</p> : null}
        </div>
      </div>
    </main>
  );
}
