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
  await db.activityLog.create({ data: { restaurantId: restaurant.id, userId: user.id, action: "category_created", description: name } });
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
  await db.activityLog.create({ data: { restaurantId: restaurant.id, userId: user.id, action: "category_updated", description: name } });
  revalidatePath("/dashboard/menu/categories");
}

export default async function CategoriesPage() {
  const { restaurant } = await getManagerRestaurant();
  const categories = await db.category.findMany({ where: { restaurantId: restaurant.id }, orderBy: { sortOrder: "asc" } });
  return (
    <main className="p-4 lg:p-6">
      <h1 className="text-2xl font-bold">Menu Categories</h1>
      <div className="mt-5 grid gap-5 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader><CardTitle>Add category</CardTitle></CardHeader>
          <CardContent>
            <form action={createCategory} className="space-y-3">
              <Input name="name" placeholder="Name" required />
              <Input name="sortOrder" type="number" placeholder="Sort order" defaultValue={categories.length + 1} />
              <Button className="w-full">Add Category</Button>
            </form>
          </CardContent>
        </Card>
        <div className="space-y-3">
          {categories.map((category) => (
            <form key={category.id} action={updateCategory} className="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-[1fr_120px_120px_140px]">
              <input type="hidden" name="id" value={category.id} />
              <Input name="name" defaultValue={category.name} />
              <Input name="sortOrder" type="number" defaultValue={category.sortOrder} />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={category.isActive} /> Active</label>
              <Button>Save</Button>
            </form>
          ))}
        </div>
      </div>
    </main>
  );
}
