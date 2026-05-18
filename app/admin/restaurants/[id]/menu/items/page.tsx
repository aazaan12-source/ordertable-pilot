import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/permissions";
import { createRestaurantCategory, createRestaurantMenuItem, deleteRestaurantMenuItem, reorderRestaurantMenuItems, updateRestaurantMenuItem } from "@/lib/admin-restaurant-actions";
import { ConfirmSubmitButton, SubmitButton } from "@/components/ui/confirm-submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MenuImagePicker } from "@/components/ui/menu-image-picker";
import { SortableGroupedReorderPanel } from "@/components/ui/sortable-reorder-panel";
import { formatCurrency } from "@/lib/utils";
import { menuImageFor, safeStoredImageUrl } from "@/lib/menu-images";
import { sortMenuItemsForDisplay } from "@/lib/menu-ordering";

export const dynamic = "force-dynamic";

export default async function AdminRestaurantMenuItemsPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdmin();
  const { id } = await params;
  const restaurant = await db.restaurant.findUnique({
    where: { id },
    include: {
      categories: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      menuItems: { include: { category: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }
    }
  });
  if (!restaurant) notFound();
  const sortedMenuItems = sortMenuItemsForDisplay(restaurant.menuItems);
  const activeCategories = restaurant.categories.filter((category) => category.isActive);
  const itemsByCategory = activeCategories.map((category) => ({
    category,
    items: sortedMenuItems.filter((item) => item.categoryId === category.id)
  }));

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
            <form action={createRestaurantCategory} className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3">
              <input type="hidden" name="restaurantId" value={restaurant.id} />
              <p className="mb-2 text-sm font-semibold text-blue-950">{activeCategories.length === 0 ? "Create a category first" : "Add a new category"}</p>
              <div className="grid gap-2">
                <Input name="name" placeholder="Example: Chicken Pulao" required />
                <MenuImagePicker itemNameField="name" defaultCategoryName="Category" />
                <SubmitButton pendingText="Creating...">Create Category</SubmitButton>
              </div>
            </form>
            <form action={createRestaurantMenuItem} className="space-y-3">
              <input type="hidden" name="restaurantId" value={restaurant.id} />
              <Input name="name" placeholder="Item name" required />
              <select name="categoryId" className="h-10 w-full rounded-md border bg-white px-3 text-sm" required disabled={activeCategories.length === 0}>
                {activeCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input name="price" type="number" min={1} placeholder="Price" required />
              </div>
              <MenuImagePicker categories={activeCategories.map((category) => ({ id: category.id, name: category.name }))} />
              <Textarea name="description" placeholder="Short description" />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isAvailable" defaultChecked /> Available now</label>
              <SubmitButton className="w-full" pendingText="Adding item..." disabled={activeCategories.length === 0}>Add Item</SubmitButton>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Arrange Menu Items</CardTitle>
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
          {sortedMenuItems.map((item) => (
            <Card id={`item-${item.id}`} key={item.id} className={!item.isActive ? "opacity-60" : ""}>
              <CardContent className="grid gap-4 p-4 lg:grid-cols-[180px_1fr]">
                <img src={menuImageFor(item.name, item.category.name, item.imageUrl)} alt={item.name} className="h-40 w-full rounded-md object-cover" />
                <div>
                  <form action={updateRestaurantMenuItem} className="space-y-3">
                    <input type="hidden" name="restaurantId" value={restaurant.id} />
                    <input type="hidden" name="id" value={item.id} />
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input name="name" defaultValue={item.name} placeholder="Item name" required />
                      <select name="categoryId" defaultValue={item.categoryId} className="h-10 rounded-md border bg-white px-3 text-sm">
                        {restaurant.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                      </select>
                      <Input name="price" type="number" defaultValue={item.price.toString()} placeholder="Price" required />
                    </div>
                    <MenuImagePicker
                      defaultValue={safeStoredImageUrl(item.imageUrl)}
                      defaultItemName={item.name}
                      defaultCategoryName={item.category.name}
                      categories={restaurant.categories.map((category) => ({ id: category.id, name: category.name }))}
                    />
                    <Textarea name="description" defaultValue={item.description} placeholder="Short customer-friendly description" />
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
          {sortedMenuItems.length === 0 ? <p className="rounded-lg border bg-white p-6 text-center text-muted-foreground">No menu items yet.</p> : null}
        </div>
      </div>
    </main>
  );
}
