import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/super-admin-auth";

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  return session?.user as
    | ({ id: string; name?: string | null; email?: string | null; role: UserRole; restaurantId?: string | null })
    | undefined;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requirePlatformAdmin() {
  return requireSuperAdmin();
}

export async function requireRestaurantManager() {
  const user = await requireUser();
  if (user.role !== "RESTAURANT_MANAGER" || !user.restaurantId) redirect("/admin");
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
