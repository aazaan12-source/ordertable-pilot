import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/permissions";
import { QrCard } from "@/components/dashboard/qr-card";

export default async function AdminQrCodesPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdmin();
  const { id } = await params;
  const restaurant = await db.restaurant.findUnique({ where: { id }, include: { tables: { orderBy: { tableNumber: "asc" } } } });
  if (!restaurant) notFound();
  const baseUrl = process.env.APP_URL || "http://127.0.0.1:3000";
  return (
    <main className="mx-auto max-w-6xl p-4 lg:p-6">
      <h1 className="text-2xl font-bold">{restaurant.name} QR Codes</h1>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {restaurant.tables.map((table) => <QrCard key={table.id} tableNumber={table.tableNumber} url={table.qrUrl} baseUrl={baseUrl} />)}
      </div>
    </main>
  );
}
