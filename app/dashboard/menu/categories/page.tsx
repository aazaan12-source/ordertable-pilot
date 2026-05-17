import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getManagerRestaurant } from "@/lib/permissions";
import { ConfirmSubmitButton, SubmitButton } from "@/components/ui/confirm-submit-button";
import { Input } from "@/components/ui/input";
import { MenuImagePicker } from "@/components/ui/menu-image-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cleanSubmittedMenuImage, safeStoredImageUrl } from "@/lib/menu-images";
import { displayPosition, normalizeCategoryPositions, reorderCategoryPositions } from "@/lib/menu-ordering";

export const dynamic = "force-dynamic";

async function revalidateCustomerMenuPages(restaurantId: string, slug: string) {
  const tables = await db.restaurantTable.findMany({
    where: { restaurantId, status: { not: "INACTIVE" } },
    select: { tableNumber: true }
  });
  for (const table of tables) {
    revalidatePath(`/r/${slug}/t/${table.tableNumber}`);
  }
}

async function createCategory(formData: FormData) {
  "use server";
  const { user, restaurant } = await getManagerRestaurant();
  const name = String(formData.get("name") || "").trim();
  const imageUrl = cleanSubmittedMenuImage(formData.get("imageUrl"));
  if (!name) return;
  const categoryCount = await db.category.count({ where: { restaurantId: restaurant.id } });
  const desiredPosition = displayPosition(formData.get("sortOrder"), categoryCount + 1, categoryCount + 1);
  await db.$transaction(async (tx) => {
    const category = await tx.category.create({ data: { restaurantId: restaurant.id, name, imageUrl, sortOrder: categoryCount + 1 } });
    await reorderCategoryPositions(tx, restaurant.id, category.id, desiredPosition);
    await tx.activityLog.create({ data: { restaurantId: restaurant.id, userId: user.id, action: "CATEGORY_CREATED", description: name } });
  });
  revalidatePath("/dashboard/menu/categories");
  revalidatePath("/dashboard/menu/items");
  revalidatePath(`/r/${restaurant.slug}/t/1`);
  await revalidateCustomerMenuPages(restaurant.id, restaurant.slug);
}

async function updateCategory(formData: FormData) {
  "use server";
  const { user, restaurant } = await getManagerRestaurant();
  const id = String(formData.get("id"));
  const name = String(formData.get("name") || "").trim();
  const imageUrl = cleanSubmittedMenuImage(formData.get("imageUrl"));
  const isActive = formData.get("isActive") === "on";
  const category = await db.category.findFirst({ where: { id, restaurantId: restaurant.id } });
  if (!category || !name) return;
  const categoryCount = await db.category.count({ where: { restaurantId: restaurant.id } });
  const desiredPosition = displayPosition(formData.get("sortOrder"), category.sortOrder || categoryCount, categoryCount);
  await db.$transaction(async (tx) => {
    await tx.category.updateMany({ where: { id, restaurantId: restaurant.id }, data: { name, imageUrl, isActive } });
    await reorderCategoryPositions(tx, restaurant.id, id, desiredPosition);
    await tx.activityLog.create({ data: { restaurantId: restaurant.id, userId: user.id, action: "CATEGORY_UPDATED", description: name } });
  });
  revalidatePath("/dashboard/menu/categories");
  revalidatePath("/dashboard/menu/items");
  revalidatePath(`/r/${restaurant.slug}/t/1`);
  await revalidateCustomerMenuPages(restaurant.id, restaurant.slug);
}

async function deleteCategory(formData: FormData) {
  "use server";
  const { user, restaurant } = await getManagerRestaurant();
  const id = String(formData.get("id"));
  const category = await db.category.findFirst({ where: { id, restaurantId: restaurant.id } });
  if (!category) return;
  await db.$transaction(async (tx) => {
    await tx.menuItem.deleteMany({ where: { categoryId: id, restaurantId: restaurant.id } });
    await tx.category.deleteMany({ where: { id, restaurantId: restaurant.id } });
    await normalizeCategoryPositions(tx, restaurant.id);
    await tx.activityLog.create({ data: { restaurantId: restaurant.id, userId: user.id, action: "CATEGORY_DELETED", description: `${category.name} permanently deleted with its menu items` } });
  });
  revalidatePath("/dashboard/menu/categories");
  revalidatePath("/dashboard/menu/items");
  revalidatePath(`/r/${restaurant.slug}/t/1`);
  await revalidateCustomerMenuPages(restaurant.id, restaurant.slug);
}

export default async function CategoriesPage() {
  const { restaurant } = await getManagerRestaurant();
  const categories = await db.category.findMany({
    where: { restaurantId: restaurant.id },
    include: { _count: { select: { menuItems: true } } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });
  return (
    <main className="p-4 lg:p-6">
      <h1 className="text-2xl font-bold">Menu Categories</h1>
      <p className="mt-1 text-sm text-muted-foreground">Keep categories short and clear. Delete removes the category and its menu items from the current menu.</p>

      <div className="mt-5 grid gap-5 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader><CardTitle>Add Category</CardTitle></CardHeader>
          <CardContent>
            <form action={createCategory} className="space-y-3">
              <Input name="name" placeholder="Example: Burgers" required />
              <MenuImagePicker itemNameField="name" defaultCategoryName="Category" />
              <Input name="sortOrder" type="number" min={1} max={categories.length + 1} placeholder="Display position, e.g. 1" defaultValue={categories.length + 1} />
              <SubmitButton className="w-full" pendingText="Adding category...">Add Category</SubmitButton>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-3">
          {categories.map((category) => (
            <Card key={category.id} className={!category.isActive ? "opacity-60" : ""}>
              <CardContent className="p-4">
                <form action={updateCategory} className="grid gap-3 md:grid-cols-[1fr_150px_120px_100px]">
                  <input type="hidden" name="id" value={category.id} />
                  <Input name="name" defaultValue={category.name} placeholder="Category name" />
                  <div className="md:col-span-4">
                    <MenuImagePicker defaultValue={safeStoredImageUrl(category.imageUrl)} defaultItemName={category.name} defaultCategoryName={category.name} itemNameField="name" />
                  </div>
                  <Input name="sortOrder" type="number" min={1} max={categories.length} defaultValue={category.sortOrder} placeholder="Position: 1 = first" />
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={category.isActive} /> Active</label>
                  <SubmitButton pendingText="Saving...">Save</SubmitButton>
                </form>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-sm text-muted-foreground">
                  <span>{category._count.menuItems} menu items</span>
                  <form action={deleteCategory}>
                    <input type="hidden" name="id" value={category.id} />
                    <ConfirmSubmitButton message="Delete this category and all its menu items?" pendingText="Deleting...">Delete</ConfirmSubmitButton>
                  </form>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
