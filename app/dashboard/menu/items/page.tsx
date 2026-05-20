import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getManagerRestaurant } from "@/lib/permissions";
import { SubmitButton } from "@/components/ui/confirm-submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MenuImagePicker } from "@/components/ui/menu-image-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MenuItemsCategoryView } from "@/components/dashboard/menu-items-category-view";
import { formatCurrency } from "@/lib/utils";
import { cleanSubmittedMenuImage, menuImageFor, safeStoredImageUrl } from "@/lib/menu-images";
import { applyMenuItemOrder, normalizeMenuItemPositions, orderedIdsFromForm, sortMenuItemsForDisplay } from "@/lib/menu-ordering";

export const dynamic = "force-dynamic";

async function revalidateManagerMenuPages(restaurantId: string, slug: string) {
  revalidatePath("/dashboard/menu/categories");
  revalidatePath("/dashboard/menu/items");
  const tables = await db.restaurantTable.findMany({
    where: { restaurantId, status: { not: "INACTIVE" } },
    select: { tableNumber: true }
  });
  for (const table of tables) {
    revalidatePath(`/r/${slug}/t/${table.tableNumber}`);
  }
}

async function createMenuItem(formData: FormData) {
  "use server";
  const { user, restaurant } = await getManagerRestaurant();
  const name = String(formData.get("name") || "").trim();
  const categoryId = String(formData.get("categoryId") || "");
  if (!name || !categoryId) return;
  const category = await db.category.findFirst({ where: { id: categoryId, restaurantId: restaurant.id } });
  if (!category) return;
  const categoryItemCount = await db.menuItem.count({ where: { restaurantId: restaurant.id, categoryId } });
  await db.$transaction(async (tx) => {
    await tx.menuItem.create({
      data: {
        restaurantId: restaurant.id,
        categoryId,
        name,
        description: String(formData.get("description") || ""),
        price: Number(formData.get("price") || 0),
        imageUrl: cleanSubmittedMenuImage(formData.get("imageUrl")),
        isAvailable: formData.get("isAvailable") === "on",
        isActive: true,
        sortOrder: categoryItemCount + 1
      }
    });
    await tx.activityLog.create({ data: { restaurantId: restaurant.id, userId: user.id, action: "MENU_ITEM_CREATED", description: name } });
  });
  await revalidateManagerMenuPages(restaurant.id, restaurant.slug);
}

async function updateMenuItem(formData: FormData) {
  "use server";
  const { user, restaurant } = await getManagerRestaurant();
  const id = String(formData.get("id"));
  const name = String(formData.get("name") || "").trim();
  const categoryId = String(formData.get("categoryId") || "");
  const category = await db.category.findFirst({ where: { id: categoryId, restaurantId: restaurant.id } });
  const item = await db.menuItem.findFirst({ where: { id, restaurantId: restaurant.id } });
  if (!name || !category || !item) return;
  const categoryItemCount = await db.menuItem.count({ where: { restaurantId: restaurant.id, categoryId } });
  await db.$transaction(async (tx) => {
    await tx.menuItem.updateMany({
      where: { id, restaurantId: restaurant.id },
      data: {
        categoryId,
        name,
        description: String(formData.get("description") || ""),
        price: Number(formData.get("price") || 0),
        imageUrl: cleanSubmittedMenuImage(formData.get("imageUrl")),
        isActive: formData.get("isActive") === "on",
        isAvailable: formData.get("isAvailable") === "on",
        sortOrder: item.categoryId === categoryId ? item.sortOrder : categoryItemCount + 1
      }
    });
    if (item.categoryId !== categoryId) await normalizeMenuItemPositions(tx, restaurant.id, item.categoryId);
    await tx.activityLog.create({ data: { restaurantId: restaurant.id, userId: user.id, action: "MENU_ITEM_UPDATED", description: name } });
  });
  await revalidateManagerMenuPages(restaurant.id, restaurant.slug);
}

async function deleteMenuItem(formData: FormData) {
  "use server";
  const { user, restaurant } = await getManagerRestaurant();
  const id = String(formData.get("id"));
  const item = await db.menuItem.findFirst({ where: { id, restaurantId: restaurant.id } });
  if (!item) return;
  await db.$transaction(async (tx) => {
    await tx.menuItem.deleteMany({ where: { id, restaurantId: restaurant.id } });
    await normalizeMenuItemPositions(tx, restaurant.id, item.categoryId);
    await tx.activityLog.create({ data: { restaurantId: restaurant.id, userId: user.id, action: "MENU_ITEM_DELETED", description: `${item.name} permanently deleted` } });
  });
  await revalidateManagerMenuPages(restaurant.id, restaurant.slug);
}

async function reorderMenuItems(formData: FormData) {
  "use server";
  const { user, restaurant } = await getManagerRestaurant();
  const categoryId = String(formData.get("categoryId") || "");
  const category = await db.category.findFirst({ where: { id: categoryId, restaurantId: restaurant.id } });
  if (!category) return;
  await db.$transaction(async (tx) => {
    await applyMenuItemOrder(tx, restaurant.id, categoryId, orderedIdsFromForm(formData));
    await tx.activityLog.create({ data: { restaurantId: restaurant.id, userId: user.id, action: "MENU_ITEM_ORDER_UPDATED", description: `${category.name} item display order updated` } });
  });
  await revalidateManagerMenuPages(restaurant.id, restaurant.slug);
}

async function createQuickCategory(formData: FormData) {
  "use server";
  const { user, restaurant } = await getManagerRestaurant();
  const name = String(formData.get("quickCategoryName") || "").trim();
  const imageUrl = cleanSubmittedMenuImage(formData.get("imageUrl"));
  if (!name) return;
  const categoryCount = await db.category.count({ where: { restaurantId: restaurant.id } });
  await db.category.create({ data: { restaurantId: restaurant.id, name, imageUrl, sortOrder: categoryCount + 1, isActive: true } });
  await db.activityLog.create({ data: { restaurantId: restaurant.id, userId: user.id, action: "CATEGORY_CREATED", description: name } });
  await revalidateManagerMenuPages(restaurant.id, restaurant.slug);
}

export default async function MenuItemsPage() {
  const { restaurant } = await getManagerRestaurant();
  const [allCategories, items] = await Promise.all([
    db.category.findMany({ where: { restaurantId: restaurant.id }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    db.menuItem.findMany({ where: { restaurantId: restaurant.id }, include: { category: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] })
  ]);
  const sortedItems = sortMenuItemsForDisplay(items);
  const activeCategories = allCategories.filter((category) => category.isActive);
  const itemsByCategory = activeCategories.map((category) => ({
    category,
    items: sortedItems.filter((item) => item.categoryId === category.id)
  }));
  const categoryOptions = allCategories.map((category) => ({ id: category.id, name: category.name }));
  const reorderGroups = itemsByCategory.map(({ category, items: categoryItems }) => ({
    id: category.id,
    label: category.name,
    items: categoryItems.map((item) => ({
      id: item.id,
      title: item.name,
      subtitle: `${category.name} - ${formatCurrency(item.price.toString())}`,
      imageUrl: menuImageFor(item.name, category.name, item.imageUrl),
      badges: [item.isAvailable ? "Available" : "Unavailable", item.isActive ? "Active" : "Inactive"],
      actions: [{ label: "Edit, status, delete", href: `#item-${item.id}` }],
      muted: !item.isActive || !item.isAvailable
    }))
  }));
  const itemCards = sortedItems.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    categoryId: item.categoryId,
    categoryName: item.category.name,
    price: item.price.toString(),
    imageUrl: safeStoredImageUrl(item.imageUrl),
    displayImageUrl: menuImageFor(item.name, item.category.name, item.imageUrl),
    isActive: item.isActive,
    isAvailable: item.isAvailable
  }));

  return (
    <main className="p-4 lg:p-6">
      <h1 className="text-2xl font-bold">Menu Items</h1>
      <p className="mt-1 text-sm text-muted-foreground">Add items with real food photos. Paste an image URL from your restaurant photos, Cloudinary, or a free stock source.</p>

      <div className="mt-5 grid gap-5 xl:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader><CardTitle>Add Menu Item</CardTitle></CardHeader>
          <CardContent>
            <form action={createQuickCategory} className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3">
              <p className="mb-2 text-sm font-semibold text-blue-950">{activeCategories.length === 0 ? "Create a category first" : "Add a new category"}</p>
              <div className="grid gap-2">
                <Input name="quickCategoryName" placeholder="Example: Chicken Pulao" required />
                <MenuImagePicker itemNameField="quickCategoryName" defaultCategoryName="Category" />
                <SubmitButton pendingText="Creating...">Create Category</SubmitButton>
              </div>
            </form>
            <form action={createMenuItem} className="space-y-3">
              <Input name="name" placeholder="Item name" required />
              <select name="categoryId" className="h-10 w-full rounded-md border bg-white px-3 text-sm" required disabled={activeCategories.length === 0}>
                {activeCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input name="price" type="number" placeholder="Price" required />
              </div>
              <MenuImagePicker categories={activeCategories.map((category) => ({ id: category.id, name: category.name }))} />
              <Textarea name="description" placeholder="Short customer-friendly description" />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isAvailable" defaultChecked /> Available now</label>
              <SubmitButton className="w-full" pendingText="Adding item..." disabled={activeCategories.length === 0}>Add Item</SubmitButton>
            </form>
          </CardContent>
        </Card>

        <MenuItemsCategoryView
          groups={reorderGroups}
          items={itemCards}
          categories={categoryOptions}
          reorderAction={reorderMenuItems}
          updateAction={updateMenuItem}
          deleteAction={deleteMenuItem}
        />
      </div>
    </main>
  );
}
