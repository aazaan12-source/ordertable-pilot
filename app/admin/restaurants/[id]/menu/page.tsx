import { notFound } from "next/navigation";
import { createRestaurantCategory, createRestaurantMenuItem, deleteRestaurantCategory, deleteRestaurantMenuItem, reorderRestaurantCategories, reorderRestaurantMenuItems, updateRestaurantCategory, updateRestaurantMenuItem } from "@/lib/admin-restaurant-actions";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/permissions";
import { AdminBreadcrumbs } from "@/components/admin/admin-breadcrumbs";
import { SubmitButton } from "@/components/ui/confirm-submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MenuImagePicker } from "@/components/ui/menu-image-picker";
import { CategoryListEditor } from "@/components/dashboard/category-list-editor";
import { MenuItemsCategoryView } from "@/components/dashboard/menu-items-category-view";
import { formatCurrency } from "@/lib/utils";
import { categoryImageFor, menuImageFor, safeStoredImageUrl } from "@/lib/menu-images";
import { sortMenuItemsForDisplay } from "@/lib/menu-ordering";

export const dynamic = "force-dynamic";

export default async function AdminRestaurantMenuPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requirePlatformAdmin();
  const { id } = await params;
  const { error } = await searchParams;
  const restaurant = await db.restaurant.findUnique({
    where: { id },
    include: {
      categories: { include: { _count: { select: { menuItems: true } } }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      menuItems: { include: { category: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }
    }
  });
  if (!restaurant) notFound();

  const activeCategories = restaurant.categories.filter((category) => category.isActive);
  const sortedMenuItems = sortMenuItemsForDisplay(restaurant.menuItems);
  const itemsByCategory = activeCategories.map((category) => ({
    category,
    items: sortedMenuItems.filter((item) => item.categoryId === category.id)
  }));
  const categoryItems = restaurant.categories.map((category) => ({
    id: category.id,
    title: category.name,
    subtitle: `${category._count.menuItems} menu item${category._count.menuItems === 1 ? "" : "s"}`,
    imageUrl: categoryImageFor(category.name, category.imageUrl),
    badges: [category.isActive ? "Active" : "Inactive"],
    actions: [{ label: "Edit, status, delete", href: `#category-${category.id}` }],
    muted: !category.isActive
  }));
  const categoryCards = restaurant.categories.map((category) => ({
    id: category.id,
    name: category.name,
    imageUrl: safeStoredImageUrl(category.imageUrl),
    isActive: category.isActive,
    itemCount: category._count.menuItems
  }));
  const categoryOptions = restaurant.categories.map((category) => ({ id: category.id, name: category.name }));
  const reorderGroups = itemsByCategory.map(({ category, items: categoryItemsForGroup }) => ({
    id: category.id,
    label: category.name,
    items: categoryItemsForGroup.map((item) => ({
      id: item.id,
      title: item.name,
      subtitle: `${category.name} - ${formatCurrency(item.price.toString())}`,
      imageUrl: menuImageFor(item.name, category.name, item.imageUrl),
      badges: [item.isAvailable ? "Available" : "Unavailable", item.isActive ? "Active" : "Inactive"],
      actions: [{ label: "Edit, status, delete", href: `#item-${item.id}` }],
      muted: !item.isActive || !item.isAvailable
    }))
  }));
  const itemCards = sortedMenuItems.map((item) => ({
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
  const restaurantHiddenFields = { restaurantId: restaurant.id };

  return (
    <main className="mx-auto max-w-7xl p-4 lg:p-6">
      <AdminBreadcrumbs items={[{ label: "Restaurants", href: "/admin/restaurants" }, { label: restaurant.name, href: `/admin/restaurants/${restaurant.id}` }, { label: "Menu Management" }]} />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Menu Management</h1>
          <p className="text-sm text-muted-foreground">Manage categories, menu items, prices, availability, photos, and customer display order for {restaurant.name}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="#categories" className="rounded-md border px-3 py-2 text-sm font-semibold hover:bg-muted">Categories</a>
          <a href="#items" className="rounded-md border px-3 py-2 text-sm font-semibold hover:bg-muted">Items</a>
        </div>
      </div>

      {error ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">Could not save that menu item. Please check the details and try again.</div> : null}

      <section id="categories" className="scroll-mt-28">
        <div className="mb-3">
          <h2 className="text-lg font-bold">Categories</h2>
          <p className="text-sm text-muted-foreground">Create and edit food groups that customers see on the order page.</p>
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

          <CategoryListEditor
            items={categoryItems}
            categories={categoryCards}
            reorderAction={reorderRestaurantCategories}
            updateAction={updateRestaurantCategory}
            deleteAction={deleteRestaurantCategory}
            hiddenFields={restaurantHiddenFields}
          />
        </div>
      </section>

      <section id="items" className="mt-8 scroll-mt-28">
        <div className="mb-3">
          <h2 className="text-lg font-bold">Items</h2>
          <p className="text-sm text-muted-foreground">Add and update menu items, prices, photos, availability, and active status.</p>
        </div>
        <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
          <Card>
            <CardHeader><CardTitle>Add Menu Item</CardTitle></CardHeader>
            <CardContent>
              <form action={createRestaurantMenuItem} className="space-y-3">
                <input type="hidden" name="restaurantId" value={restaurant.id} />
                <Input name="name" placeholder="Item name" required />
                <select name="categoryId" className="h-10 w-full rounded-md border bg-white px-3 text-sm" required disabled={activeCategories.length === 0}>
                  {activeCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
                <Input name="price" type="number" placeholder="Price" required />
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
            reorderAction={reorderRestaurantMenuItems}
            updateAction={updateRestaurantMenuItem}
            deleteAction={deleteRestaurantMenuItem}
            hiddenFields={restaurantHiddenFields}
          />
        </div>
      </section>
    </main>
  );
}
