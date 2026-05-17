import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/permissions";
import { regenerateRestaurantQRCodes } from "@/lib/admin-restaurant-actions";
import { Button } from "@/components/ui/button";
import { QrCard } from "@/components/dashboard/qr-card";

export const dynamic = "force-dynamic";

export default async function AdminQrCodesPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdmin();
  const { id } = await params;
  const restaurant = await db.restaurant.findUnique({
    where: { id },
    include: { tables: { where: { status: { not: "INACTIVE" } }, orderBy: { tableNumber: "asc" } } }
  });
  if (!restaurant) notFound();
  const baseUrl = (process.env.APP_URL || process.env.NEXTAUTH_URL || "").replace(/\/$/, "");

  return (
    <main className="mx-auto max-w-7xl p-4 lg:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">QR Codes</h1>
          <p className="text-sm text-muted-foreground">{restaurant.name} - {restaurant.branchName} · {restaurant.tables.length} active tables</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={regenerateRestaurantQRCodes}>
            <input type="hidden" name="restaurantId" value={restaurant.id} />
            <Button variant="outline">Regenerate All QR URLs</Button>
          </form>
        </div>
      </div>
      <p className="mb-4 rounded-md border bg-white p-3 text-sm text-muted-foreground print:hidden">
        Each QR sign includes a centered table number, scan instruction text, and a larger QR area. Use PNG download for individual table signs or browser print for the full grid.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 print:grid-cols-2">
        {restaurant.tables.map((table) => (
          <div key={table.id} className="break-inside-avoid">
            <QrCard tableNumber={table.tableNumber} url={table.qrUrl} baseUrl={baseUrl} restaurantName={restaurant.name} />
          </div>
        ))}
      </div>
    </main>
  );
}
