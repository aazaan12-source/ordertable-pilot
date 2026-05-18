import { db } from "@/lib/db";
import { getManagerRestaurant } from "@/lib/permissions";
import { LiveOrders } from "@/components/dashboard/live-orders";

export const dynamic = "force-dynamic";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { restaurant } = await getManagerRestaurant();
  const { status } = await searchParams;
  const orders = await db.order.findMany({
    where: { restaurantId: restaurant.id },
    include: { table: true, items: true, waiterRequests: true },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return (
    <main id="live-orders" className="scroll-mt-4 p-4 lg:p-6">
      <h1 className="text-2xl font-bold">Live Orders</h1>
      <p className="mb-5 text-sm text-muted-foreground">Auto-refreshes every second. Handles online QR and manual orders.</p>
      <LiveOrders initialOrders={JSON.parse(JSON.stringify(orders))} restaurantName={restaurant.name} initialStatus={status} />
    </main>
  );
}
