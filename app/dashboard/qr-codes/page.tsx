import { db } from "@/lib/db";
import { getManagerRestaurant } from "@/lib/permissions";
import { QrCard } from "@/components/dashboard/qr-card";

export const dynamic = "force-dynamic";

export default async function QrCodesPage() {
  const { restaurant } = await getManagerRestaurant();
  const tables = await db.restaurantTable.findMany({
    where: { restaurantId: restaurant.id, status: { not: "INACTIVE" } },
    orderBy: { tableNumber: "asc" }
  });
  const baseUrl = (process.env.APP_URL || process.env.NEXTAUTH_URL || "").replace(/\/$/, "");
  return (
    <main className="p-4 lg:p-6">
      <h1 className="text-2xl font-bold">QR Codes</h1>
      <p className="mb-5 text-sm text-muted-foreground">Print these QR codes for each physical table.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 print:grid-cols-2">
        {tables.map((table) => <QrCard key={table.id} tableNumber={table.tableNumber} url={table.qrUrl} baseUrl={baseUrl} restaurantName={restaurant.name} />)}
      </div>
    </main>
  );
}
