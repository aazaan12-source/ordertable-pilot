import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getManagerRestaurant } from "@/lib/permissions";
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
  if (!name) return;
  const count = await db.restaurantWaiter.count({ where: { restaurantId: restaurant.id } });
  try {
    await db.$transaction([
      db.restaurantWaiter.create({
        data: { restaurantId: restaurant.id, name, sortOrder: count + 1, isActive: true }
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

async function deleteSelectedWaiters(formData: FormData) {
  "use server";
  const { user, restaurant } = await getManagerRestaurant();
  const ids = formData.getAll("waiterIds").map((value) => String(value)).filter(Boolean);
  if (ids.length === 0) return;
  const waiters = await db.restaurantWaiter.findMany({
    where: { id: { in: ids }, restaurantId: restaurant.id },
    select: { id: true, name: true }
  });
  if (waiters.length === 0) return;
  await db.$transaction([
    db.restaurantWaiter.deleteMany({ where: { id: { in: waiters.map((waiter) => waiter.id) }, restaurantId: restaurant.id } }),
    db.activityLog.create({
      data: {
        restaurantId: restaurant.id,
        userId: user.id,
        action: "WAITER_DELETED",
        description: `${waiters.map((waiter) => waiter.name).join(", ")} removed from waiter list`
      }
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
        <p className="text-sm text-muted-foreground">Add waiter names once. The same list appears on every table QR page for waiter-assisted ordering.</p>
      </div>

      <Card className="max-w-3xl">
        <CardHeader><CardTitle>Waiters</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <form action={createWaiter} className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Input name="name" placeholder="Type waiter name and press Add" maxLength={80} required />
            <SubmitButton pendingText="Adding...">Add Waiter</SubmitButton>
          </form>

          <form action={deleteSelectedWaiters} className="space-y-3">
            {waiters.length > 0 ? (
              <div className="max-h-[460px] overflow-y-auto rounded-md border bg-white">
                {waiters.map((waiter) => (
                  <label key={waiter.id} className="flex cursor-pointer items-center gap-3 border-b px-3 py-3 text-sm last:border-b-0 hover:bg-muted">
                    <input type="checkbox" name="waiterIds" value={waiter.id} className="h-4 w-4" />
                    <span className="font-medium">{waiter.name}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="rounded-md border bg-muted p-6 text-center text-sm text-muted-foreground">
                No waiters added yet.
              </p>
            )}
            {waiters.length > 0 ? (
              <ConfirmSubmitButton message="Delete the selected waiter names?" pendingText="Deleting selected...">
                Delete Selected
              </ConfirmSubmitButton>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
