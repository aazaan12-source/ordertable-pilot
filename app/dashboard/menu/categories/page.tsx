import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getManagerRestaurant } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

async function createCategory(formData: FormData) {
  "use server";
  const { user, restaurant } = await getManagerRestaurant();
  const name = String(formData.get("name") || "").trim();
  const sortOrder = Number(formData.get("sortOrder") || 0);
  if (!name) return;
  await db.category.create({ data: { restaurantId: restaurant.id, name, sortOrder } });
  await db.activityLog.create({ data: { restaurantId: restaurant.id, userId: user.id, action: "CATEGORY_CREATED", description: name } });
  revalidatePath("/dashboard/menu/categories");
}

async function updateCategory(formData: FormData) {
  "use server";
  const { user, restaurant } = await getManagerRestaurant();
  const id = String(formData.get("id"));
  const name = String(formData.get("name") || "").trim();
  const sortOrder = Number(formData.get("sortOrder") || 0);
  const isActive = formData.get("isActive") === "on";
  await db.category.updateMany({ where: { id, restaurantId: restaurant.id }, data: { name, sortOrder, isActive } });
  await db.activityLog.create({ data: { restaurantId: restaurant.id, userId: user.id, action: "CATEGORY_UPDATED", description: name } });
  revalidatePath("/dashboard/menu/categories");
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
    await tx.activityLog.create({ data: { restaurantId: restaurant.id, userId: user.id, action: "CATEGORY_DELETED", description: `${category.name} permanently deleted with its menu items` } });
  });
  revalidatePath("/dashboard/menu/categories");
  revalidatePath("/dashboard/menu/items");
}

export default async function CategoriesPage() {
  const { restaurant } = await getManagerRestaurant();
  const categories = await db.category.findMany({
    where: { restaurantId: restaurant.id },
    include: { _count: { select: { menuItems: true } } },
    orderBy: { sortOrder: "asc" }
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
              <Input name="sortOrder" type="number" placeholder="Sort order" defaultValue={categories.length + 1} />
              <Button className="w-full">Add Category</Button>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-3">
          {categories.map((category) => (
            <Card key={category.id} className={!category.isActive ? "opacity-60" : ""}>
              <CardContent className="p-4">
                <form action={updateCategory} className="grid gap-3 md:grid-cols-[1fr_100px_120px_100px]">
                  <input type="hidden" name="id" value={category.id} />
                  <Input name="name" defaultValue={category.name} />
                  <Input name="sortOrder" type="number" defaultValue={category.sortOrder} />
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={category.isActive} /> Active</label>
                  <Button>Save</Button>
                </form>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-sm text-muted-foreground">
                  <span>{category._count.menuItems} menu items</span>
                  <form action={deleteCategory}>
                    <input type="hidden" name="id" value={category.id} />
                    <Button variant="destructive" size="sm">Delete</Button>
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
