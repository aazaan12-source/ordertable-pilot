import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getManagerRestaurant } from "@/lib/permissions";
import { SubmitButton } from "@/components/ui/confirm-submit-button";
import { Input } from "@/components/ui/input";
import { MenuImagePicker } from "@/components/ui/menu-image-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryListEditor } from "@/components/dashboard/category-list-editor";
import { categoryImageFor, cleanSubmittedMenuImage, safeStoredImageUrl } from "@/lib/menu-images";
import { applyCategoryOrder, normalizeCategoryPositions, orderedIdsFromForm } from "@/lib/menu-ordering";

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
  await db.$transaction(async (tx) => {
    await tx.category.create({ data: { restaurantId: restaurant.id, name, imageUrl, sortOrder: categoryCount + 1 } });
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
  await db.$transaction(async (tx) => {
    await tx.category.updateMany({ where: { id, restaurantId: restaurant.id }, data: { name, imageUrl, isActive } });
    await tx.activityLog.create({ data: { restaurantId: restaurant.id, userId: user.id, action: "CATEGORY_UPDATED", description: name } });
  });
  revalidatePath("/dashboard/menu/categories");
  revalidatePath("/dashboard/menu/items");
  revalidatePath(`/r/${restaurant.slug}/t/1`);
  await revalidateCustomerMenuPages(restaurant.id, restaurant.slug);
}

async function reorderCategories(formData: FormData) {
  "use server";
  const { user, restaurant } = await getManagerRestaurant();
  const orderedIds = orderedIdsFromForm(formData);
  await db.$transaction(async (tx) => {
    await applyCategoryOrder(tx, restaurant.id, orderedIds);
    await tx.activityLog.create({ data: { restaurantId: restaurant.id, userId: user.id, action: "CATEGORY_ORDER_UPDATED", description: "Menu category display order updated" } });
  });
  revalidatePath("/dashboard/menu/categories");
  revalidatePath("/dashboard/menu/items");
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
  const categoryItems = categories.map((category) => ({
    id: category.id,
    title: category.name,
    subtitle: `${category._count.menuItems} menu item${category._count.menuItems === 1 ? "" : "s"}`,
    imageUrl: categoryImageFor(category.name, category.imageUrl),
    badges: [category.isActive ? "Active" : "Inactive"],
    actions: [{ label: "Edit, status, delete", href: `#category-${category.id}` }],
    muted: !category.isActive
  }));
  const categoryCards = categories.map((category) => ({
    id: category.id,
    name: category.name,
    imageUrl: safeStoredImageUrl(category.imageUrl),
    isActive: category.isActive,
    itemCount: category._count.menuItems
  }));

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
              <SubmitButton className="w-full" pendingText="Adding category...">Add Category</SubmitButton>
            </form>
          </CardContent>
        </Card>

        <CategoryListEditor
          items={categoryItems}
          categories={categoryCards}
          reorderAction={reorderCategories}
          updateAction={updateCategory}
          deleteAction={deleteCategory}
        />
      </div>
    </main>
  );
}
