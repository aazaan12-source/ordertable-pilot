import { Prisma } from "@prisma/client";

type MenuOrderingClient = Pick<Prisma.TransactionClient, "category" | "menuItem">;

export function orderedIdsFromForm(formData: FormData, fieldName = "orderedIds") {
  return String(formData.get(fieldName) || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export function sortMenuItemsForDisplay<T extends { sortOrder: number; createdAt: Date; category: { sortOrder: number; createdAt?: Date } }>(items: T[]) {
  return [...items].sort((left, right) => {
    const categoryOrder = left.category.sortOrder - right.category.sortOrder;
    if (categoryOrder !== 0) return categoryOrder;

    const itemOrder = left.sortOrder - right.sortOrder;
    if (itemOrder !== 0) return itemOrder;

    return left.createdAt.getTime() - right.createdAt.getTime();
  });
}

export async function applyCategoryOrder(tx: MenuOrderingClient, restaurantId: string, orderedIds: string[]) {
  const categories = await tx.category.findMany({
    where: { restaurantId },
    select: { id: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });
  const validIds = new Set(categories.map((category) => category.id));
  const nextIds = [...orderedIds.filter((id) => validIds.has(id)), ...categories.map((category) => category.id).filter((id) => !orderedIds.includes(id))];

  for (const [index, id] of nextIds.entries()) {
    await tx.category.update({ where: { id }, data: { sortOrder: index + 1 } });
  }
}

export async function applyMenuItemOrder(tx: MenuOrderingClient, restaurantId: string, categoryId: string, orderedIds: string[]) {
  const items = await tx.menuItem.findMany({
    where: { restaurantId, categoryId },
    select: { id: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });
  const validIds = new Set(items.map((item) => item.id));
  const nextIds = [...orderedIds.filter((id) => validIds.has(id)), ...items.map((item) => item.id).filter((id) => !orderedIds.includes(id))];

  for (const [index, id] of nextIds.entries()) {
    await tx.menuItem.update({ where: { id }, data: { sortOrder: index + 1 } });
  }
}

export async function normalizeCategoryPositions(tx: MenuOrderingClient, restaurantId: string) {
  const categories = await tx.category.findMany({
    where: { restaurantId },
    select: { id: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });

  for (const [index, category] of categories.entries()) {
    await tx.category.update({
      where: { id: category.id },
      data: { sortOrder: index + 1 }
    });
  }
}

export async function normalizeMenuItemPositions(tx: MenuOrderingClient, restaurantId: string, categoryId: string) {
  const items = await tx.menuItem.findMany({
    where: { restaurantId, categoryId },
    select: { id: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });

  for (const [index, item] of items.entries()) {
    await tx.menuItem.update({
      where: { id: item.id },
      data: { sortOrder: index + 1 }
    });
  }
}
