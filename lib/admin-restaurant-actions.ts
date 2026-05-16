"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { LeadStatus, Prisma, RestaurantStatus, SubscriptionStatus, TableStatus, UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/permissions";
import { absoluteTableQrUrl } from "@/lib/qr";
import { imageForSeededItem, sampleCategoryNames, sampleMenuItems } from "@/lib/sample-menu";
import { categoryImageFor } from "@/lib/menu-images";
import { slugifyRestaurant } from "@/lib/admin-restaurant-utils";

function formString(formData: FormData, key: string, fallback = "") {
  return String(formData.get(key) || fallback).trim();
}

function positiveInt(value: FormDataEntryValue | null, fallback: number, max = 500) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(1, Math.floor(parsed)));
}

function redirectNewRestaurantError(error: string): never {
  redirect(`/admin/restaurants/new?error=${encodeURIComponent(error)}`);
}

function safeNumber(value: FormDataEntryValue | null, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function safeDate(value: FormDataEntryValue | null) {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

type MenuWriter = Pick<Prisma.TransactionClient, "category" | "menuItem">;

async function createSampleMenu(tx: MenuWriter, restaurantId: string) {
  for (const [categoryIndex, categoryName] of sampleCategoryNames.entries()) {
    const category = await tx.category.create({
      data: { restaurantId, name: categoryName, imageUrl: categoryImageFor(categoryName), sortOrder: categoryIndex + 1 }
    });

    for (const [itemIndex, item] of sampleMenuItems[categoryName].entries()) {
      await tx.menuItem.create({
        data: {
          restaurantId,
          categoryId: category.id,
          name: item.name,
          description: item.description,
          price: item.price,
          imageUrl: imageForSeededItem(item.name),
          sortOrder: itemIndex + 1,
          isActive: true,
          isAvailable: true
        }
      });
    }
  }
}

export async function syncRestaurantTables({
  restaurantId,
  slug,
  targetCount,
  startAt = 1,
  userId
}: {
  restaurantId: string;
  slug: string;
  targetCount: number;
  startAt?: number;
  userId?: string;
}) {
  const currentTables = await db.restaurantTable.findMany({ where: { restaurantId }, orderBy: { tableNumber: "asc" } });
  const desiredNumbers = new Set(Array.from({ length: targetCount }, (_, index) => startAt + index));

  await db.$transaction(async (tx) => {
    for (const tableNumber of desiredNumbers) {
      const existing = currentTables.find((table) => table.tableNumber === tableNumber);
      if (existing) {
        await tx.restaurantTable.update({
          where: { id: existing.id },
          data: { qrUrl: absoluteTableQrUrl(slug, tableNumber), status: existing.status === TableStatus.INACTIVE ? TableStatus.EMPTY : existing.status }
        });
      } else {
        await tx.restaurantTable.create({
          data: { restaurantId, tableNumber, qrUrl: absoluteTableQrUrl(slug, tableNumber), status: TableStatus.EMPTY }
        });
      }
    }

    for (const table of currentTables) {
      if (!desiredNumbers.has(table.tableNumber)) {
        await tx.restaurantTable.update({
          where: { id: table.id },
          data: { status: TableStatus.INACTIVE, qrUrl: absoluteTableQrUrl(slug, table.tableNumber) }
        });
      }
    }

    await tx.activityLog.create({
      data: {
        userId,
        restaurantId,
        action: "TABLES_UPDATED",
        description: `Synced active table range to ${startAt}-${startAt + targetCount - 1}. Extra tables were deactivated, not deleted.`
      }
    });
  });
}

export async function createRestaurantWithTablesAndManager(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const name = formString(formData, "name");
  const branchName = formString(formData, "branchName", "Main Branch");
  const city = formString(formData, "city");
  const address = formString(formData, "address");
  const phone = formString(formData, "phone");
  const slug = slugifyRestaurant(formString(formData, "slug") || `${name}-${branchName}-${city}`);
  const tableCount = positiveInt(formData.get("tableCount"), 10);
  const startingTableNumber = positiveInt(formData.get("startingTableNumber"), 1);
  const managerEmail = formString(formData, "managerEmail").toLowerCase();
  const managerPassword = formString(formData, "managerPassword", "Manager12345");
  const managerPasswordConfirm = formString(formData, "managerPasswordConfirm", managerPassword);
  const managerName = formString(formData, "managerName", "Restaurant Manager");
  const managerPhone = formString(formData, "managerPhone") || null;
  const menuSetup = formString(formData, "menuSetup", "empty");
  const leadId = formString(formData, "leadId");

  if (!name || !slug || !city || !managerEmail || !managerPassword) redirectNewRestaurantError("missing-required-fields");
  if (managerPassword !== managerPasswordConfirm) redirectNewRestaurantError("password-mismatch");

  const exists = await db.restaurant.findUnique({ where: { slug } });
  if (exists) redirectNewRestaurantError("slug-already-exists");

  const emailExists = await db.user.findUnique({ where: { email: managerEmail } });
  if (emailExists) redirectNewRestaurantError("manager-email-already-exists");

  const passwordHash = await bcrypt.hash(managerPassword, 12);
  let restaurant: { id: string } | null = null;

  try {
    restaurant = await db.restaurant.create({
      data: {
        name,
        slug,
        branchName,
        city,
        address,
        phone,
        logoUrl: formString(formData, "logoUrl") || null,
        status: formString(formData, "status", "ACTIVE") === "INACTIVE" ? RestaurantStatus.INACTIVE : RestaurantStatus.ACTIVE,
        subscriptionStatus: formString(formData, "subscriptionStatus", "PILOT") as SubscriptionStatus,
        orderingEnabled: formData.get("orderingEnabled") !== "false",
        pilotStartDate: safeDate(formData.get("pilotStartDate")),
        pilotEndDate: safeDate(formData.get("pilotEndDate")),
        serviceChargePercent: safeNumber(formData.get("serviceChargePercent"), 0),
        taxPercent: safeNumber(formData.get("taxPercent"), 0),
        customerCancelWindowMinutes: positiveInt(formData.get("customerCancelWindowMinutes"), 3, 60),
        tables: {
          create: Array.from({ length: tableCount }, (_, index) => {
            const tableNumber = startingTableNumber + index;
            return { tableNumber, qrUrl: absoluteTableQrUrl(slug, tableNumber), status: TableStatus.EMPTY };
          })
        },
        users: {
          create: {
            name: managerName,
            email: managerEmail,
            phone: managerPhone,
            passwordHash,
            role: UserRole.RESTAURANT_MANAGER,
            isActive: formData.get("managerIsActive") !== "false"
          }
        },
        subscriptions: {
          create: {
            planName: formString(formData, "subscriptionStatus", "PILOT"),
            monthlyPrice: safeNumber(formData.get("monthlyPrice"), 0),
            status: "ACTIVE",
            startDate: new Date()
          }
        },
        activityLogs: {
          create: {
            userId: admin.id,
            action: "RESTAURANT_CREATED",
            description: `${name} created with ${tableCount} tables`
          }
        }
      },
      select: { id: true }
    });
  } catch (error) {
    console.error("[createRestaurantWithTablesAndManager] failed", { error, slug, managerEmail, tableCount });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirectNewRestaurantError("duplicate-record");
    }
    redirectNewRestaurantError("server-error");
  }

  if (!restaurant) redirectNewRestaurantError("server-error");

  if (leadId) {
    await db.platformLead.update({
      where: { id: leadId },
      data: { status: "CONVERTED", convertedRestaurantId: restaurant.id }
    }).catch((error) => {
      console.error("[createRestaurantWithTablesAndManager] lead conversion update failed", { error, leadId, restaurantId: restaurant.id });
    });
  }

  if (menuSetup === "sample") {
    await createSampleMenu(db, restaurant.id).catch((error) => {
      console.error("[createRestaurantWithTablesAndManager] sample menu creation failed", { error, restaurantId: restaurant.id });
    });
  }

  revalidatePath("/admin/restaurants");
  redirect(`/admin/restaurants/${restaurant.id}`);
}

export async function updateRestaurantDetails(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const id = formString(formData, "id");
  const current = await db.restaurant.findUnique({ where: { id }, include: { tables: true } });
  if (!current) return;
  const menuSetup = formString(formData, "menuSetup", "keep");
  const slug = slugifyRestaurant(formString(formData, "slug", current.slug));
  const updated = await db.restaurant.update({
    where: { id },
    data: {
      name: formString(formData, "name", current.name),
      slug,
      branchName: formString(formData, "branchName", current.branchName),
      city: formString(formData, "city", current.city),
      address: formString(formData, "address", current.address),
      phone: formString(formData, "phone", current.phone),
      logoUrl: formString(formData, "logoUrl") || null,
      status: formString(formData, "status", current.status) as RestaurantStatus,
      subscriptionStatus: formString(formData, "subscriptionStatus", current.subscriptionStatus) as SubscriptionStatus,
      orderingEnabled: formData.get("orderingEnabled") === "on",
      pilotStartDate: formData.get("pilotStartDate") ? new Date(String(formData.get("pilotStartDate"))) : null,
      pilotEndDate: formData.get("pilotEndDate") ? new Date(String(formData.get("pilotEndDate"))) : null,
      serviceChargePercent: Number(formData.get("serviceChargePercent") || 0),
      taxPercent: Number(formData.get("taxPercent") || 0),
      customerCancelWindowMinutes: positiveInt(formData.get("customerCancelWindowMinutes"), 3, 60)
    }
  });

  if (updated.slug !== current.slug) {
    await db.$transaction(
      current.tables.map((table) =>
        db.restaurantTable.update({ where: { id: table.id }, data: { qrUrl: absoluteTableQrUrl(updated.slug, table.tableNumber) } })
      )
    );
  }

  if (menuSetup === "empty") {
    await db.$transaction([
      db.menuItem.deleteMany({ where: { restaurantId: id } }),
      db.category.deleteMany({ where: { restaurantId: id } }),
      db.activityLog.create({ data: { userId: admin.id, restaurantId: id, action: "MENU_CLEARED", description: `${updated.name} menu cleared from restaurant edit` } })
    ]);
  }

  if (menuSetup === "sample") {
    const categoryCount = await db.category.count({ where: { restaurantId: id } });
    if (categoryCount === 0) {
      await createSampleMenu(db, id);
      await db.activityLog.create({ data: { userId: admin.id, restaurantId: id, action: "SAMPLE_MENU_CREATED", description: `${updated.name} sample menu created from restaurant edit` } });
    } else {
      await db.activityLog.create({ data: { userId: admin.id, restaurantId: id, action: "SAMPLE_MENU_SKIPPED", description: `${updated.name} already had menu categories; sample menu was not duplicated` } });
    }
  }

  await db.activityLog.create({ data: { userId: admin.id, restaurantId: id, action: "RESTAURANT_UPDATED", description: `${updated.name} updated` } });
  revalidatePath(`/admin/restaurants/${id}`);
  revalidatePath(`/admin/restaurants/${id}/edit`);
  redirect(`/admin/restaurants/${id}/edit?saved=1`);
}

export async function deleteRestaurantCompletely(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const restaurantId = formString(formData, "restaurantId");
  const confirmation = formString(formData, "confirmation");
  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    include: { users: { select: { id: true } } }
  });
  if (!restaurant) return;
  if (restaurant.status !== RestaurantStatus.INACTIVE) {
    redirect(`/admin/restaurants/${restaurantId}?error=delete-active`);
  }
  if (confirmation !== restaurant.slug) {
    redirect(`/admin/restaurants/${restaurantId}?error=delete-confirmation`);
  }

  const userIds = restaurant.users.map((user) => user.id);

  await db.$transaction([
    db.activityLog.deleteMany({ where: { OR: [{ restaurantId }, ...(userIds.length ? [{ userId: { in: userIds } }] : [])] } }),
    db.platformLead.updateMany({ where: { convertedRestaurantId: restaurantId }, data: { convertedRestaurantId: null, status: "CONTACTED" } }),
    db.feedback.deleteMany({ where: { restaurantId } }),
    db.waiterRequest.deleteMany({ where: { restaurantId } }),
    db.orderItem.deleteMany({ where: { order: { restaurantId } } }),
    db.order.deleteMany({ where: { restaurantId } }),
    db.menuItem.deleteMany({ where: { restaurantId } }),
    db.category.deleteMany({ where: { restaurantId } }),
    db.restaurantTable.deleteMany({ where: { restaurantId } }),
    db.billingInvoice.deleteMany({ where: { restaurantId } }),
    db.subscription.deleteMany({ where: { restaurantId } }),
    db.user.deleteMany({ where: { restaurantId } }),
    db.restaurant.delete({ where: { id: restaurantId } }),
    db.activityLog.create({ data: { userId: admin.id, action: "RESTAURANT_DELETED", description: `${restaurant.name} (${restaurant.slug}) was completely deleted` } })
  ]);

  revalidatePath("/admin");
  revalidatePath("/admin/restaurants");
  redirect("/admin/restaurants?deleted=1");
}

export async function toggleRestaurantStatus(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const id = formString(formData, "id");
  const status = formString(formData, "status") as RestaurantStatus;
  await db.restaurant.update({ where: { id }, data: { status } });
  await db.activityLog.create({
    data: { userId: admin.id, restaurantId: id, action: status === "ACTIVE" ? "RESTAURANT_ACTIVATED" : "RESTAURANT_DEACTIVATED", description: `Restaurant ${status}` }
  });
  revalidatePath("/admin/restaurants");
  revalidatePath(`/admin/restaurants/${id}`);
}

export async function toggleOrdering(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const id = formString(formData, "id");
  const orderingEnabled = formData.get("orderingEnabled") === "true";
  await db.restaurant.update({ where: { id }, data: { orderingEnabled } });
  await db.activityLog.create({
    data: { userId: admin.id, restaurantId: id, action: orderingEnabled ? "ORDERING_ENABLED" : "ORDERING_DISABLED", description: `Ordering ${orderingEnabled ? "enabled" : "disabled"}` }
  });
  revalidatePath("/admin/restaurants");
  revalidatePath(`/admin/restaurants/${id}`);
}

export async function updateRestaurantTableCount(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const restaurantId = formString(formData, "restaurantId");
  const targetCount = positiveInt(formData.get("tableCount"), 1);
  const startAt = positiveInt(formData.get("startingTableNumber"), 1);
  const restaurant = await db.restaurant.findUnique({ where: { id: restaurantId } });
  if (!restaurant) return;
  await syncRestaurantTables({ restaurantId, slug: restaurant.slug, targetCount, startAt, userId: admin.id });
  revalidatePath(`/admin/restaurants/${restaurantId}/tables`);
  revalidatePath(`/admin/restaurants/${restaurantId}/qr-codes`);
}

export async function updateSingleTable(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const tableId = formString(formData, "tableId");
  const restaurantId = formString(formData, "restaurantId");
  const tableNumber = positiveInt(formData.get("tableNumber"), 1);
  const status = formString(formData, "status", "EMPTY") as TableStatus;
  const restaurant = await db.restaurant.findUnique({ where: { id: restaurantId } });
  if (!restaurant) return;
  await db.restaurantTable.update({ where: { id: tableId }, data: { tableNumber, status, qrUrl: absoluteTableQrUrl(restaurant.slug, tableNumber) } });
  await db.activityLog.create({ data: { userId: admin.id, restaurantId, action: "TABLES_UPDATED", description: `Table ${tableNumber} updated to ${status}` } });
  revalidatePath(`/admin/restaurants/${restaurantId}/tables`);
}

export async function regenerateRestaurantQRCodes(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const restaurantId = formString(formData, "restaurantId");
  const restaurant = await db.restaurant.findUnique({ where: { id: restaurantId }, include: { tables: true } });
  if (!restaurant) return;
  await db.$transaction(async (tx) => {
    for (const table of restaurant.tables) {
      await tx.restaurantTable.update({ where: { id: table.id }, data: { qrUrl: absoluteTableQrUrl(restaurant.slug, table.tableNumber) } });
    }
    await tx.activityLog.create({ data: { userId: admin.id, restaurantId, action: "QR_CODES_GENERATED", description: "QR URLs regenerated for all tables" } });
  });
  revalidatePath(`/admin/restaurants/${restaurantId}/qr-codes`);
}

export async function createRestaurantCategory(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const restaurantId = formString(formData, "restaurantId");
  const name = formString(formData, "name");
  if (!name) return;
  await db.category.create({ data: { restaurantId, name, imageUrl: formString(formData, "imageUrl") || null, sortOrder: Number(formData.get("sortOrder") || 0), isActive: true } });
  await db.activityLog.create({ data: { userId: admin.id, restaurantId, action: "MENU_CATEGORY_CREATED", description: name } });
  revalidatePath(`/admin/restaurants/${restaurantId}/menu/categories`);
}

export async function updateRestaurantCategory(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const restaurantId = formString(formData, "restaurantId");
  const id = formString(formData, "id");
  const name = formString(formData, "name");
  await db.category.updateMany({
    where: { id, restaurantId },
    data: { name, imageUrl: formString(formData, "imageUrl") || null, sortOrder: Number(formData.get("sortOrder") || 0), isActive: formData.get("isActive") === "on" }
  });
  await db.activityLog.create({ data: { userId: admin.id, restaurantId, action: "MENU_CATEGORY_UPDATED", description: name } });
  revalidatePath(`/admin/restaurants/${restaurantId}/menu/categories`);
}

export async function deleteRestaurantCategory(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const restaurantId = formString(formData, "restaurantId");
  const id = formString(formData, "id");
  const category = await db.category.findFirst({ where: { id, restaurantId } });
  if (!category) return;
  await db.$transaction(async (tx) => {
    await tx.menuItem.deleteMany({ where: { restaurantId, categoryId: id } });
    await tx.category.deleteMany({ where: { restaurantId, id } });
    await tx.activityLog.create({ data: { userId: admin.id, restaurantId, action: "MENU_CATEGORY_DELETED", description: `${category.name} deleted with its menu items` } });
  });
  revalidatePath(`/admin/restaurants/${restaurantId}/menu/categories`);
  revalidatePath(`/admin/restaurants/${restaurantId}/menu/items`);
}

export async function createRestaurantMenuItem(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const restaurantId = formString(formData, "restaurantId");
  const name = formString(formData, "name");
  const categoryId = formString(formData, "categoryId");
  if (!name || !categoryId) return;
  await db.menuItem.create({
    data: {
      restaurantId,
      categoryId,
      name,
      description: formString(formData, "description"),
      price: Number(formData.get("price") || 0),
      imageUrl: formString(formData, "imageUrl") || null,
      isActive: formData.get("isActive") !== "false",
      isAvailable: formData.get("isAvailable") === "on",
      sortOrder: Number(formData.get("sortOrder") || 0)
    }
  });
  await db.activityLog.create({ data: { userId: admin.id, restaurantId, action: "MENU_ITEM_CREATED", description: name } });
  revalidatePath(`/admin/restaurants/${restaurantId}/menu/items`);
}

export async function updateRestaurantMenuItem(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const restaurantId = formString(formData, "restaurantId");
  const id = formString(formData, "id");
  const name = formString(formData, "name");
  await db.menuItem.updateMany({
    where: { id, restaurantId },
    data: {
      categoryId: formString(formData, "categoryId"),
      name,
      description: formString(formData, "description"),
      price: Number(formData.get("price") || 0),
      imageUrl: formString(formData, "imageUrl") || null,
      isActive: formData.get("isActive") === "on",
      isAvailable: formData.get("isAvailable") === "on",
      sortOrder: Number(formData.get("sortOrder") || 0)
    }
  });
  await db.activityLog.create({ data: { userId: admin.id, restaurantId, action: "MENU_ITEM_UPDATED", description: name } });
  revalidatePath(`/admin/restaurants/${restaurantId}/menu/items`);
}

export async function deleteRestaurantMenuItem(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const restaurantId = formString(formData, "restaurantId");
  const id = formString(formData, "id");
  const item = await db.menuItem.findFirst({ where: { id, restaurantId } });
  if (!item) return;
  await db.menuItem.deleteMany({ where: { id, restaurantId } });
  await db.activityLog.create({ data: { userId: admin.id, restaurantId, action: "MENU_ITEM_DELETED", description: `${item.name} deleted` } });
  revalidatePath(`/admin/restaurants/${restaurantId}/menu/items`);
}

export async function createOrUpdateRestaurantManager(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const restaurantId = formString(formData, "restaurantId");
  const id = formString(formData, "id");
  const email = formString(formData, "email").toLowerCase();
  const password = formString(formData, "password");
  const data = {
    name: formString(formData, "name", "Restaurant Manager"),
    email,
    phone: formString(formData, "phone") || null,
    isActive: formData.get("isActive") === "on",
    role: "RESTAURANT_MANAGER" as const,
    restaurantId
  };
  if (id) {
    await db.user.update({ where: { id }, data: password ? { ...data, passwordHash: await bcrypt.hash(password, 12) } : data });
  } else if (email && password) {
    await db.user.create({ data: { ...data, passwordHash: await bcrypt.hash(password, 12) } });
  }
  await db.activityLog.create({ data: { userId: admin.id, restaurantId, action: id ? "MANAGER_UPDATED" : "MANAGER_CREATED", description: email } });
  revalidatePath(`/admin/restaurants/${restaurantId}/manager`);
}

export async function updateOnboardingLeadStatus(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const id = formString(formData, "id");
  const status = formString(formData, "status") as LeadStatus;
  await db.platformLead.update({ where: { id }, data: { status } });
  await db.activityLog.create({ data: { userId: admin.id, action: "ONBOARDING_REQUEST_UPDATED", description: `Request ${id} changed to ${status}` } });
  revalidatePath("/admin/onboarding-requests");
  revalidatePath("/admin/requests");
}
