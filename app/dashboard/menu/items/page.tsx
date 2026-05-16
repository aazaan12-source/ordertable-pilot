import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getManagerRestaurant } from "@/lib/permissions";
import { ConfirmSubmitButton, SubmitButton } from "@/components/ui/confirm-submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MenuImagePicker } from "@/components/ui/menu-image-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { menuImageFor } from "@/lib/menu-images";

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
      isAvailable: formData.get("isAvailable") === "on",
      isActive: true,
      sortOrder: Number(formData.get("sortOrder") || 0)
    }
  });
  await db.activityLog.create({ data: { restaurantId: restaurant.id, userId: user.id, action: "MENU_ITEM_CREATED", description: name } });
  revalidatePath("/dashboard/menu/items");
  revalidatePath(`/r/${restaurant.slug}/t/1`);
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
  await db.activityLog.create({ data: { restaurantId: restaurant.id, userId: user.id, action: "MENU_ITEM_UPDATED", description: name } });
  revalidatePath("/dashboard/menu/items");
}

async function deleteMenuItem(formData: FormData) {
  "use server";
  const { user, restaurant } = await getManagerRestaurant();
  const id = String(formData.get("id"));
  const item = await db.menuItem.findFirst({ where: { id, restaurantId: restaurant.id } });
  if (!item) return;
  await db.$transaction(async (tx) => {
    await tx.menuItem.deleteMany({ where: { id, restaurantId: restaurant.id } });
    await tx.activityLog.create({ data: { restaurantId: restaurant.id, userId: user.id, action: "MENU_ITEM_DELETED", description: `${item.name} permanently deleted` } });
  });
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
      <p className="mt-1 text-sm text-muted-foreground">Add items with real food photos. Paste an image URL from your restaurant photos, Cloudinary, or a free stock source.</p>

      <div className="mt-5 grid gap-5 xl:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader><CardTitle>Add Menu Item</CardTitle></CardHeader>
          <CardContent>
            <form action={createMenuItem} className="space-y-3">
              <Input name="name" placeholder="Item name" required />
              <select name="categoryId" className="h-10 w-full rounded-md border bg-white px-3 text-sm" required>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input name="price" type="number" placeholder="Price" required />
                <Input name="sortOrder" type="number" placeholder="Sort order" defaultValue={1} />
              </div>
              <MenuImagePicker categories={categories.map((category) => ({ id: category.id, name: category.name }))} />
              <Textarea name="description" placeholder="Short customer-friendly description" />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isAvailable" defaultChecked /> Available now</label>
              <SubmitButton className="w-full" pendingText="Adding item...">Add Item</SubmitButton>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          {items.map((item) => (
            <Card key={item.id} className={!item.isActive ? "opacity-60" : ""}>
              <CardContent className="grid gap-4 p-4 lg:grid-cols-[180px_1fr]">
                <img src={menuImageFor(item.name, item.category.name, item.imageUrl)} alt={item.name} className="h-40 w-full rounded-md object-cover" />
                <div>
                  <form action={updateMenuItem} className="space-y-3">
                    <input type="hidden" name="id" value={item.id} />
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input name="name" defaultValue={item.name} />
                      <select name="categoryId" className="h-10 rounded-md border bg-white px-3 text-sm" defaultValue={item.categoryId}>
                        {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                      </select>
                      <Input name="price" type="number" defaultValue={item.price.toString()} />
                      <Input name="sortOrder" type="number" defaultValue={item.sortOrder} />
                    </div>
                    <MenuImagePicker
                      defaultValue={item.imageUrl}
                      defaultItemName={item.name}
                      defaultCategoryName={item.category.name}
                      categories={categories.map((category) => ({ id: category.id, name: category.name }))}
                    />
                    <Textarea name="description" defaultValue={item.description} />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-4 text-sm">
                        <label className="flex items-center gap-2"><input type="checkbox" name="isAvailable" defaultChecked={item.isAvailable} /> Available</label>
                        <label className="flex items-center gap-2"><input type="checkbox" name="isActive" defaultChecked={item.isActive} /> Active</label>
                      </div>
                      <div className="flex gap-2">
                        <SubmitButton pendingText="Saving...">Save</SubmitButton>
                      </div>
                    </div>
                  </form>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-sm text-muted-foreground">
                    <p>{item.category.name} · {formatCurrency(item.price.toString())}</p>
                    <form action={deleteMenuItem}>
                      <input type="hidden" name="id" value={item.id} />
                      <ConfirmSubmitButton message="Delete this menu item?" pendingText="Deleting...">Delete</ConfirmSubmitButton>
                    </form>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
