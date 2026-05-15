import { db } from "@/lib/db";
import { getManagerRestaurant } from "@/lib/permissions";
import { LiveOrders } from "@/components/dashboard/live-orders";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const { restaurant } = await getManagerRestaurant();
  const orders = await db.order.findMany({
    where: { restaurantId: restaurant.id },
    include: { table: true, items: true, waiterRequests: true },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return (
    <main className="p-4 lg:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Live Orders</h1>
          <p className="text-sm text-muted-foreground">Auto-refreshes every 5 seconds. Handles online QR and manual orders.</p>
        </div>
        <Link href="/dashboard/orders/new"><Button>Create Manual Order</Button></Link>
      </div>
      <LiveOrders initialOrders={JSON.parse(JSON.stringify(orders))} restaurantName={restaurant.name} />
    </main>
  );
}
