import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/super-admin-auth";

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  const user = session?.user as
    | ({ id: string; name?: string | null; email?: string | null; role: UserRole; restaurantId?: string | null })
    | undefined;
  if (!user?.id || !user.role) return undefined;
  if ((user as any).isActive === false) return undefined;
  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const freshUser = await db.user.findUnique({
    where: { id: user.id },
    select: { id: true, name: true, email: true, role: true, restaurantId: true, isActive: true }
  });
  if (!freshUser?.isActive) redirect("/login");
  return freshUser;
}

export async function requirePlatformAdmin() {
  return requireSuperAdmin();
}

export async function requireRestaurantManager() {
  const user = await requireUser();
  if (user.role !== "RESTAURANT_MANAGER" || !user.restaurantId) redirect("/login?error=restaurant-required");
  return user;
}

export async function getManagerRestaurant() {
  const user = await requireRestaurantManager();
  const restaurant = await db.restaurant.findUnique({ where: { id: user.restaurantId! } });
  if (!restaurant) redirect("/login");
  return { user, restaurant };
}

export function canAccessRestaurant(user: { role: UserRole; restaurantId?: string | null }, restaurantId: string) {
  return user.role === "PLATFORM_ADMIN" || user.restaurantId === restaurantId;
}

export async function assertRestaurantAccess(restaurantId: string) {
  const user = await requireUser();
  if (user.role === "PLATFORM_ADMIN") {
    const restaurant = await db.restaurant.findUnique({ where: { id: restaurantId }, select: { id: true } });
    if (!restaurant) redirect("/admin/restaurants");
    return { user, restaurantId };
  }
  if (user.role !== "RESTAURANT_MANAGER" || user.restaurantId !== restaurantId) {
    redirect("/login?error=unauthorized");
  }
  return { user, restaurantId: user.restaurantId };
}

export async function assertOrderAccess(orderId: string) {
  const user = await requireUser();
  const order = await db.order.findUnique({ where: { id: orderId }, select: { id: true, restaurantId: true } });
  if (!order || (user.role !== "PLATFORM_ADMIN" && order.restaurantId !== user.restaurantId)) {
    redirect("/login?error=unauthorized");
  }
  return { user, order };
}

export async function assertMenuItemAccess(menuItemId: string) {
  const user = await requireUser();
  const menuItem = await db.menuItem.findUnique({ where: { id: menuItemId }, select: { id: true, restaurantId: true } });
  if (!menuItem || (user.role !== "PLATFORM_ADMIN" && menuItem.restaurantId !== user.restaurantId)) {
    redirect("/login?error=unauthorized");
  }
  return { user, menuItem };
}

export async function assertTableAccess(tableId: string) {
  const user = await requireUser();
  const table = await db.restaurantTable.findUnique({ where: { id: tableId }, select: { id: true, restaurantId: true } });
  if (!table || (user.role !== "PLATFORM_ADMIN" && table.restaurantId !== user.restaurantId)) {
    redirect("/login?error=unauthorized");
  }
  return { user, table };
}
