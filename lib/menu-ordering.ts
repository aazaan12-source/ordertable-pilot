import { Prisma } from "@prisma/client";

type MenuOrderingClient = Pick<Prisma.TransactionClient, "category" | "menuItem">;

export function displayPosition(value: FormDataEntryValue | null, fallback: number, max = 500) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return Math.min(max, Math.max(1, fallback));
  return Math.min(max, Math.max(1, Math.floor(parsed)));
}

export async function reorderCategoryPositions(tx: MenuOrderingClient, restaurantId: string, movedCategoryId: string, desiredPosition: number) {
  const categories = await tx.category.findMany({
    where: { restaurantId },
    select: { id: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });
  const nextIds = categories.filter((category) => category.id !== movedCategoryId).map((category) => category.id);
  nextIds.splice(Math.min(nextIds.length, Math.max(0, desiredPosition - 1)), 0, movedCategoryId);

  await Promise.all(
    nextIds.map((id, index) =>
      tx.category.update({
        where: { id },
        data: { sortOrder: index + 1 }
      })
    )
  );
}

export async function normalizeCategoryPositions(tx: MenuOrderingClient, restaurantId: string) {
  const categories = await tx.category.findMany({
    where: { restaurantId },
    select: { id: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });

  await Promise.all(
    categories.map((category, index) =>
      tx.category.update({
        where: { id: category.id },
        data: { sortOrder: index + 1 }
      })
    )
  );
}

export async function reorderMenuItemPositions(tx: MenuOrderingClient, restaurantId: string, categoryId: string, movedItemId: string, desiredPosition: number) {
  const items = await tx.menuItem.findMany({
    where: { restaurantId, categoryId },
    select: { id: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });
  const nextIds = items.filter((item) => item.id !== movedItemId).map((item) => item.id);
  nextIds.splice(Math.min(nextIds.length, Math.max(0, desiredPosition - 1)), 0, movedItemId);

  await Promise.all(
    nextIds.map((id, index) =>
      tx.menuItem.update({
        where: { id },
        data: { sortOrder: index + 1 }
      })
    )
  );
}

export async function normalizeMenuItemPositions(tx: MenuOrderingClient, restaurantId: string, categoryId: string) {
  const items = await tx.menuItem.findMany({
    where: { restaurantId, categoryId },
    select: { id: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });

  await Promise.all(
    items.map((item, index) =>
      tx.menuItem.update({
        where: { id: item.id },
        data: { sortOrder: index + 1 }
      })
    )
  );
}
