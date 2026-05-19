import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getManagerRestaurant } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmSubmitButton, SubmitButton } from "@/components/ui/confirm-submit-button";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

function text(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

async function revalidateWaiterPages(slug: string) {
  revalidatePath("/dashboard/waiters");
  const tables = await db.restaurantTable.findMany({
    where: { restaurant: { slug }, status: { not: "INACTIVE" } },
    select: { tableNumber: true }
  });
  for (const table of tables) revalidatePath(`/r/${slug}/t/${table.tableNumber}`);
}

async function createWaiter(formData: FormData) {
  "use server";
  const { user, restaurant } = await getManagerRestaurant();
  const name = text(formData, "name").slice(0, 80);
  const phone = text(formData, "phone").slice(0, 40) || null;
  if (!name) return;
  const count = await db.restaurantWaiter.count({ where: { restaurantId: restaurant.id } });
  try {
    await db.$transaction([
      db.restaurantWaiter.create({
        data: { restaurantId: restaurant.id, name, phone, sortOrder: count + 1, isActive: true }
      }),
      db.activityLog.create({
        data: { restaurantId: restaurant.id, userId: user.id, action: "WAITER_CREATED", description: `${name} added to waiter list` }
      })
    ]);
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) {
      console.error("[createWaiter] failed", error);
    }
  }
  await revalidateWaiterPages(restaurant.slug);
}

async function updateWaiter(formData: FormData) {
  "use server";
  const { user, restaurant } = await getManagerRestaurant();
  const id = text(formData, "id");
  const name = text(formData, "name").slice(0, 80);
  const phone = text(formData, "phone").slice(0, 40) || null;
  const isActive = formData.get("isActive") === "on";
  if (!id || !name) return;
  try {
    await db.$transaction([
      db.restaurantWaiter.updateMany({ where: { id, restaurantId: restaurant.id }, data: { name, phone, isActive } }),
      db.activityLog.create({
        data: { restaurantId: restaurant.id, userId: user.id, action: "WAITER_UPDATED", description: `${name} waiter list entry updated` }
      })
    ]);
  } catch (error) {
    console.error("[updateWaiter] failed", error);
  }
  await revalidateWaiterPages(restaurant.slug);
}

async function deleteWaiter(formData: FormData) {
  "use server";
  const { user, restaurant } = await getManagerRestaurant();
  const id = text(formData, "id");
  const waiter = await db.restaurantWaiter.findFirst({ where: { id, restaurantId: restaurant.id } });
  if (!waiter) return;
  await db.$transaction([
    db.restaurantWaiter.delete({ where: { id: waiter.id } }),
    db.activityLog.create({
      data: { restaurantId: restaurant.id, userId: user.id, action: "WAITER_DELETED", description: `${waiter.name} removed from waiter list` }
    })
  ]);
  await revalidateWaiterPages(restaurant.slug);
}

export default async function WaitersPage() {
  const { restaurant } = await getManagerRestaurant();
  const waiters = await db.restaurantWaiter.findMany({
    where: { restaurantId: restaurant.id },
    orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { name: "asc" }]
  });

  return (
    <main className="p-4 lg:p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Waiter List</h1>
        <p className="text-sm text-muted-foreground">Maintain waiter names for QR waiter-assisted ordering. These names appear in the table QR page dropdown.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader><CardTitle>Add Waiter</CardTitle></CardHeader>
          <CardContent>
            <form action={createWaiter} className="space-y-3">
              <Input name="name" placeholder="Waiter name" maxLength={80} required />
              <Input name="phone" placeholder="Phone optional" maxLength={40} />
              <SubmitButton className="w-full" pendingText="Adding waiter...">Add Waiter</SubmitButton>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-3">
          {waiters.map((waiter) => (
            <Card key={waiter.id} className={!waiter.isActive ? "opacity-60" : ""}>
              <CardContent className="p-4">
                <form action={updateWaiter} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                  <input type="hidden" name="id" value={waiter.id} />
                  <Input name="name" defaultValue={waiter.name} placeholder="Waiter name" maxLength={80} required />
                  <Input name="phone" defaultValue={waiter.phone || ""} placeholder="Phone optional" maxLength={40} />
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="isActive" defaultChecked={waiter.isActive} />
                    Active
                  </label>
                  <div className="flex flex-wrap gap-2 md:col-span-3">
                    <Button>Save</Button>
                  </div>
                </form>
                <form action={deleteWaiter} className="mt-3 border-t pt-3">
                  <input type="hidden" name="id" value={waiter.id} />
                  <ConfirmSubmitButton message={`Delete ${waiter.name} from the waiter list?`} pendingText="Deleting...">Delete</ConfirmSubmitButton>
                </form>
              </CardContent>
            </Card>
          ))}
          {waiters.length === 0 ? (
            <p className="rounded-lg border bg-white p-6 text-center text-muted-foreground">
              No waiters added yet. Add names here and they will appear on the QR waiter dropdown.
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}
