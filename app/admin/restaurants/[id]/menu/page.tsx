import { notFound } from "next/navigation";
import { createRestaurantCategory, createRestaurantMenuItem, deleteRestaurantCategory, deleteRestaurantMenuItem, reorderRestaurantCategories, reorderRestaurantMenuItems, updateRestaurantCategory, updateRestaurantMenuItem } from "@/lib/admin-restaurant-actions";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/permissions";
import { AdminBreadcrumbs } from "@/components/admin/admin-breadcrumbs";
import { ConfirmSubmitButton, SubmitButton } from "@/components/ui/confirm-submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MenuImagePicker } from "@/components/ui/menu-image-picker";
import { SortableGroupedReorderPanel, SortableReorderPanel } from "@/components/ui/sortable-reorder-panel";
import { formatCurrency } from "@/lib/utils";
import { menuImageFor, safeStoredImageUrl } from "@/lib/menu-images";
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
          <a href="#sorting" className="rounded-md border px-3 py-2 text-sm font-semibold hover:bg-muted">Sorting</a>
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

          <div className="grid gap-3">
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
            {restaurant.categories.length === 0 ? <p className="rounded-lg border bg-white p-6 text-center text-muted-foreground">No categories added yet.</p> : null}
          </div>
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

          <div className="grid gap-4">
            {sortedMenuItems.map((item) => (
              <Card id={`item-${item.id}`} key={item.id} className={!item.isActive ? "opacity-60" : ""}>
                <CardContent className="grid gap-4 p-4 lg:grid-cols-[180px_1fr]">
                  <img src={menuImageFor(item.name, item.category.name, item.imageUrl)} alt={item.name} className="h-40 w-full rounded-md object-cover" />
                  <div>
                    <form action={updateRestaurantMenuItem} className="space-y-3">
                      <input type="hidden" name="restaurantId" value={restaurant.id} />
                      <input type="hidden" name="id" value={item.id} />
                      <div className="grid gap-3 md:grid-cols-2">
                        <Input name="name" defaultValue={item.name} placeholder="Item name" />
                        <select name="categoryId" className="h-10 rounded-md border bg-white px-3 text-sm" defaultValue={item.categoryId}>
                          {restaurant.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                        </select>
                        <Input name="price" type="number" defaultValue={item.price.toString()} placeholder="Price" />
                      </div>
                      <MenuImagePicker
                        defaultValue={safeStoredImageUrl(item.imageUrl)}
                        defaultItemName={item.name}
                        defaultCategoryName={item.category.name}
                        categories={restaurant.categories.map((category) => ({ id: category.id, name: category.name }))}
                      />
                      <Textarea name="description" defaultValue={item.description} placeholder="Short customer-friendly description" />
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-4 text-sm">
                          <label className="flex items-center gap-2"><input type="checkbox" name="isAvailable" defaultChecked={item.isAvailable} /> Available</label>
                          <label className="flex items-center gap-2"><input type="checkbox" name="isActive" defaultChecked={item.isActive} /> Active</label>
                        </div>
                        <SubmitButton pendingText="Saving...">Save</SubmitButton>
                      </div>
                    </form>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-sm text-muted-foreground">
                      <p>{item.category.name} - {formatCurrency(item.price.toString())}</p>
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
            {sortedMenuItems.length === 0 ? <p className="rounded-lg border bg-white p-6 text-center text-muted-foreground">No menu items added yet.</p> : null}
          </div>
        </div>
      </section>

      <section id="sorting" className="mt-8 scroll-mt-28">
        <div className="mb-3">
          <h2 className="text-lg font-bold">Sorting</h2>
          <p className="text-sm text-muted-foreground">Control the display order customers see after scanning a QR code.</p>
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Category Order</CardTitle>
              <p className="text-sm text-muted-foreground">Click Reorder Categories, drag by the handle, then save.</p>
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
          <Card>
            <CardHeader>
              <CardTitle>Item Order</CardTitle>
              <p className="text-sm text-muted-foreground">Select a category first, then reorder items within that category.</p>
            </CardHeader>
            <CardContent>
              <SortableGroupedReorderPanel
                groups={itemsByCategory.map(({ category, items: categoryItems }) => ({
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
                }))}
                action={reorderRestaurantMenuItems}
                hiddenFields={{ restaurantId: restaurant.id }}
              />
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}

