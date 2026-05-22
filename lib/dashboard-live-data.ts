import { db } from "@/lib/db";

export async function getDashboardOrders(restaurantId: string) {
  return db.order.findMany({
    where: { restaurantId },
    include: { table: true, items: true, waiterRequests: true },
    orderBy: { createdAt: "desc" },
    take: 100
  });
}

export async function getDashboardSummary(restaurantId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [pending, paid, revenue, waiterRequests] = await Promise.all([
    db.order.count({ where: { restaurantId, status: "PENDING", createdAt: { gte: today } } }),
    db.order.count({ where: { restaurantId, status: "PAID", createdAt: { gte: today } } }),
    db.order.aggregate({ where: { restaurantId, status: "PAID", createdAt: { gte: today } }, _sum: { total: true } }),
    db.waiterRequest.count({ where: { restaurantId, status: "PENDING" } })
  ]);
  return {
    pending,
    paid,
    revenue: revenue._sum.total?.toString() || "0",
    waiterRequests
  };
}

