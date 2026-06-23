import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getManagerRestaurant } from "@/lib/permissions";
import { SubmitButton } from "@/components/ui/confirm-submit-button";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

async function createDepartment(formData: FormData) {
  "use server";
  const { user, restaurant } = await getManagerRestaurant();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  const existing = await db.department.findFirst({ where: { restaurantId: restaurant.id, name } });
  if (existing) return;
  const count = await db.department.count({ where: { restaurantId: restaurant.id } });
  await db.$transaction(async (tx) => {
    await tx.department.create({ data: { restaurantId: restaurant.id, name, sortOrder: count + 1 } });
    await tx.activityLog.create({ data: { restaurantId: restaurant.id, userId: user.id, action: "DEPARTMENT_CREATED", description: name } });
  });
  revalidatePath("/dashboard/menu/departments");
}

async function updateDepartment(formData: FormData) {
  "use server";
  const { user, restaurant } = await getManagerRestaurant();
  const id = String(formData.get("id"));
  const name = String(formData.get("name") || "").trim();
  const isActive = formData.get("isActive") === "on";
  const department = await db.department.findFirst({ where: { id, restaurantId: restaurant.id } });
  if (!department || !name) return;
  await db.$transaction(async (tx) => {
    await tx.department.updateMany({ where: { id, restaurantId: restaurant.id }, data: { name, isActive } });
    await tx.activityLog.create({ data: { restaurantId: restaurant.id, userId: user.id, action: "DEPARTMENT_UPDATED", description: name } });
  });
  revalidatePath("/dashboard/menu/departments");
}

async function deleteDepartment(formData: FormData) {
  "use server";
  const { user, restaurant } = await getManagerRestaurant();
  const id = String(formData.get("id"));
  const department = await db.department.findFirst({ where: { id, restaurantId: restaurant.id } });
  if (!department) return;
  await db.$transaction(async (tx) => {
    // Categories keep existing; their departmentId is cleared by the FK (SET NULL).
    await tx.department.deleteMany({ where: { id, restaurantId: restaurant.id } });
    await tx.activityLog.create({ data: { restaurantId: restaurant.id, userId: user.id, action: "DEPARTMENT_DELETED", description: department.name } });
  });
  revalidatePath("/dashboard/menu/departments");
}

async function assignCategoryDepartment(formData: FormData) {
  "use server";
  const { restaurant } = await getManagerRestaurant();
  const categoryId = String(formData.get("categoryId"));
  const rawDepartmentId = String(formData.get("departmentId") || "");
  const category = await db.category.findFirst({ where: { id: categoryId, restaurantId: restaurant.id } });
  if (!category) return;
  let departmentId: string | null = null;
  if (rawDepartmentId) {
    const department = await db.department.findFirst({ where: { id: rawDepartmentId, restaurantId: restaurant.id } });
    if (!department) return;
    departmentId = department.id;
  }
  await db.category.updateMany({ where: { id: categoryId, restaurantId: restaurant.id }, data: { departmentId } });
  revalidatePath("/dashboard/menu/departments");
}

export default async function DepartmentsPage() {
  const { restaurant } = await getManagerRestaurant();
  const [departments, categories] = await Promise.all([
    db.department.findMany({
      where: { restaurantId: restaurant.id },
      include: { _count: { select: { categories: true } } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    }),
    db.category.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, departmentId: true, isActive: true }
    })
  ]);
  const activeDepartments = departments.filter((department) => department.isActive);

  return (
    <main className="p-4 lg:p-6">
      <h1 className="text-2xl font-bold">Menu Departments</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Departments group menu categories (for example Kitchen, Bar, Beverages) so sales reports can be broken down department-wise.
      </p>

      <div className="mt-5 grid gap-5 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader><CardTitle>Add Department</CardTitle></CardHeader>
          <CardContent>
            <form action={createDepartment} className="space-y-3">
              <Input name="name" placeholder="Example: Beverages" required />
              <SubmitButton className="w-full" pendingText="Adding department...">Add Department</SubmitButton>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Departments</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {departments.length === 0 ? (
              <p className="rounded-md border bg-white p-6 text-center text-muted-foreground">No departments yet. Add one to start grouping categories.</p>
            ) : null}
            {departments.map((department) => (
              <div key={department.id} className="rounded-md border p-3">
                <form action={updateDepartment} className="flex flex-wrap items-center gap-3">
                  <input type="hidden" name="id" value={department.id} />
                  <Input name="name" defaultValue={department.name} className="max-w-xs" />
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input type="checkbox" name="isActive" defaultChecked={department.isActive} className="h-4 w-4" />
                    Active
                  </label>
                  <span className="text-sm text-muted-foreground">{department._count.categories} categor{department._count.categories === 1 ? "y" : "ies"}</span>
                  <SubmitButton pendingText="Saving...">Save</SubmitButton>
                </form>
                <form action={deleteDepartment} className="mt-2">
                  <input type="hidden" name="id" value={department.id} />
                  <Button type="submit" variant="destructive" size="sm">Delete department</Button>
                </form>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Assign Categories to Departments</CardTitle>
          <p className="text-sm text-muted-foreground">Set the department for each category. Categories left as None appear under Unassigned in department reports.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {categories.length === 0 ? (
            <p className="rounded-md border bg-white p-6 text-center text-muted-foreground">No categories yet. Add categories first.</p>
          ) : null}
          {categories.map((category) => (
            <form key={category.id} action={assignCategoryDepartment} className="flex flex-wrap items-center gap-3 border-b pb-3 last:border-0">
              <input type="hidden" name="categoryId" value={category.id} />
              <span className="min-w-[160px] font-semibold">{category.name}{category.isActive ? "" : " (inactive)"}</span>
              <select name="departmentId" defaultValue={category.departmentId || ""} className="h-10 rounded-md border bg-white px-3 text-sm">
                <option value="">None (Unassigned)</option>
                {activeDepartments.map((department) => (
                  <option key={department.id} value={department.id}>{department.name}</option>
                ))}
              </select>
              <SubmitButton pendingText="Saving...">Save</SubmitButton>
            </form>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}
