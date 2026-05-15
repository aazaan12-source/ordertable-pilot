import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getManagerRestaurant } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function createMenuItem(formData: FormData) {
  "use server";
  const { user, restaurant } = await getManagerRestaurant();
  const name = String(formData.get("name") || "").trim();
  const categoryId = String(formData.get("categoryId") || "");
  if (!name || !categoryId) return;
  await db.menuItem.create({
    data: {
      restaurantId: restaurant.id,
      categoryId,
      name,
      description: String(formData.get("description") || ""),
      price: Number(formData.get("price") || 0),
      imageUrl: String(formData.get("imageUrl") || "") || null,
      sortOrder: Number(formData.get("sortOrder") || 0)
    }
  });
  await db.activityLog.create({ data: { restaurantId: restaurant.id, userId: user.id, action: "menu_item_created", description: name } });
  revalidatePath("/dashboard/menu/items");
}

async function updateMenuItem(formData: FormData) {
  "use server";
  const { user, restaurant } = await getManagerRestaurant();
  const id = String(formData.get("id"));
  const name = String(formData.get("name") || "").trim();
  await db.menuItem.updateMany({
    where: { id, restaurantId: restaurant.id },
    data: {
      categoryId: String(formData.get("categoryId")),
      name,
      description: String(formData.get("description") || ""),
      price: Number(formData.get("price") || 0),
      imageUrl: String(formData.get("imageUrl") || "") || null,
      isActive: formData.get("isActive") === "on",
      isAvailable: formData.get("isAvailable") === "on",
      sortOrder: Number(formData.get("sortOrder") || 0)
    }
  });
  await db.activityLog.create({ data: { restaurantId: restaurant.id, userId: user.id, action: "menu_item_updated", description: name } });
  revalidatePath("/dashboard/menu/items");
}

export default async function MenuItemsPage() {
  const { restaurant } = await getManagerRestaurant();
  const [categories, items] = await Promise.all([
    db.category.findMany({ where: { restaurantId: restaurant.id, isActive: true }, orderBy: { sortOrder: "asc" } }),
    db.menuItem.findMany({ where: { restaurantId: restaurant.id }, include: { category: true }, orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }] })
  ]);
  return (
    <main className="p-4 lg:p-6">
      <h1 className="text-2xl font-bold">Menu Items</h1>
      <div className="mt-5 grid gap-5 xl:grid-cols-[400px_1fr]">
        <Card>
          <CardHeader><CardTitle>Add menu item</CardTitle></CardHeader>
          <CardContent>
            <form action={createMenuItem} className="space-y-3">
              <Input name="name" placeholder="Name" required />
              <select name="categoryId" className="h-10 w-full rounded-md border bg-white px-3 text-sm" required>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
              <Input name="price" type="number" placeholder="Price" required />
              <Textarea name="description" placeholder="Description" />
              <Input name="imageUrl" placeholder="Image URL or leave blank" />
              <Input name="sortOrder" type="number" placeholder="Sort order" defaultValue={1} />
              <Button className="w-full">Add Item</Button>
            </form>
          </CardContent>
        </Card>
        <div className="space-y-4">
          {items.map((item) => (
            <form key={item.id} action={updateMenuItem} className="rounded-lg border bg-white p-4">
              <input type="hidden" name="id" value={item.id} />
              <div className="grid gap-3 md:grid-cols-2">
                <Input name="name" defaultValue={item.name} />
                <select name="categoryId" className="h-10 rounded-md border bg-white px-3 text-sm" defaultValue={item.categoryId}>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
                <Input name="price" type="number" defaultValue={item.price.toString()} />
                <Input name="sortOrder" type="number" defaultValue={item.sortOrder} />
                <Input name="imageUrl" defaultValue={item.imageUrl || ""} placeholder="Image URL" />
                <div className="flex items-center gap-4 text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" name="isAvailable" defaultChecked={item.isAvailable} /> Available</label>
                  <label className="flex items-center gap-2"><input type="checkbox" name="isActive" defaultChecked={item.isActive} /> Active</label>
                </div>
              </div>
              <Textarea className="mt-3" name="description" defaultValue={item.description} />
              <div className="mt-3 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{item.category.name} · {formatCurrency(item.price.toString())}</p>
                <Button>Save</Button>
              </div>
            </form>
          ))}
        </div>
      </div>
    </main>
  );
}
