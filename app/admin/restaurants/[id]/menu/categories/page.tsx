import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/permissions";
import { createRestaurantCategory, deleteRestaurantCategory, reorderRestaurantCategories, updateRestaurantCategory } from "@/lib/admin-restaurant-actions";
import { ConfirmSubmitButton, SubmitButton } from "@/components/ui/confirm-submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MenuImagePicker } from "@/components/ui/menu-image-picker";
import { SortableReorderPanel } from "@/components/ui/sortable-reorder-panel";
import { safeStoredImageUrl } from "@/lib/menu-images";

export const dynamic = "force-dynamic";

export default async function AdminRestaurantCategoriesPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdmin();
  const { id } = await params;
  const restaurant = await db.restaurant.findUnique({
    where: { id },
    include: { categories: { include: { _count: { select: { menuItems: true } } }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } }
  });
  if (!restaurant) notFound();

  return (
    <main className="mx-auto max-w-6xl p-4 lg:p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Menu Categories</h1>
        <p className="text-sm text-muted-foreground">Managing menu for: <strong>{restaurant.name} - {restaurant.branchName}</strong></p>
      </div>
      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader><CardTitle>Add Category</CardTitle></CardHeader>
          <CardContent>
            <form action={createRestaurantCategory} className="space-y-3">
              <input type="hidden" name="restaurantId" value={restaurant.id} />
              <Input name="name" placeholder="Example: Burgers" required />
              <MenuImagePicker itemNameField="name" defaultCategoryName="Category" />
              <SubmitButton className="w-full" pendingText="Adding category...">Add Category</SubmitButton>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-3">
          <Card>
            <CardHeader>
              <CardTitle>Arrange Category Order</CardTitle>
              <p className="text-sm text-muted-foreground">Click Reorder, drag categories by the handle, then save. This is the order customers see.</p>
            </CardHeader>
            <CardContent>
              <SortableReorderPanel
                items={restaurant.categories.map((category) => ({
                  id: category.id,
                  title: category.name,
                  subtitle: `${category._count.menuItems} menu item${category._count.menuItems === 1 ? "" : "s"}`,
                  badges: [category.isActive ? "Active" : "Inactive"],
                  actions: [{ label: "Edit, status, delete", href: `#category-${category.id}` }],
                  muted: !category.isActive
                }))}
                action={reorderRestaurantCategories}
                hiddenFields={{ restaurantId: restaurant.id }}
                reorderLabel="Reorder Categories"
                reorderButtonLabel="Reorder Categories"
                saveLabel="Save Category Order"
                emptyText="No categories to arrange yet."
              />
            </CardContent>
          </Card>
          {restaurant.categories.map((category) => (
            <Card id={`category-${category.id}`} key={category.id} className={!category.isActive ? "opacity-60" : ""}>
              <CardContent className="p-4">
                <form action={updateRestaurantCategory} className="grid gap-3 md:grid-cols-[1fr_130px_100px]">
                  <input type="hidden" name="restaurantId" value={restaurant.id} />
                  <input type="hidden" name="id" value={category.id} />
                  <Input name="name" defaultValue={category.name} placeholder="Category name" required />
                  <div className="md:col-span-3">
                    <MenuImagePicker defaultValue={safeStoredImageUrl(category.imageUrl)} defaultItemName={category.name} defaultCategoryName={category.name} itemNameField="name" />
                  </div>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={category.isActive} /> Active</label>
                  <SubmitButton pendingText="Saving...">Save</SubmitButton>
                </form>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-sm text-muted-foreground">
                  <span>{category._count.menuItems} menu items</span>
                  <form action={deleteRestaurantCategory}>
                    <input type="hidden" name="restaurantId" value={restaurant.id} />
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
