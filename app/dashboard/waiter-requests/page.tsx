import { db } from "@/lib/db";
import { getManagerRestaurant } from "@/lib/permissions";
import { WaiterRequestsList } from "@/components/dashboard/waiter-requests-list";

export const dynamic = "force-dynamic";

export default async function WaiterRequestsPage() {
  const { restaurant } = await getManagerRestaurant();
  const requests = await db.waiterRequest.findMany({
    where: { restaurantId: restaurant.id, status: "PENDING" },
    include: { table: true, order: true },
    orderBy: { createdAt: "desc" }
  });
  return (
    <main className="p-4 lg:p-6">
      <h1 className="text-2xl font-bold">Waiter Requests</h1>
      <p className="mb-5 text-sm text-muted-foreground">Call waiter, bill, water, and clean table requests.</p>
      <WaiterRequestsList initialRequests={JSON.parse(JSON.stringify(requests))} />
    </main>
  );
}
