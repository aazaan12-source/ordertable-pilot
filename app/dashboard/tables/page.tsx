import { db } from "@/lib/db";
import { getManagerRestaurant } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { CopyUrlButton } from "@/components/dashboard/copy-url-button";
import { TableQrImage } from "@/components/dashboard/table-qr-image";

export const dynamic = "force-dynamic";

export default async function TablesPage() {
  const { restaurant } = await getManagerRestaurant();
  const tables = await db.restaurantTable.findMany({
    where: { restaurantId: restaurant.id, status: { not: "INACTIVE" } },
    include: {
      requests: {
        where: { type: "BILL_REQUEST", status: "PENDING" },
        orderBy: { createdAt: "desc" },
        take: 1
      }
    },
    orderBy: { tableNumber: "asc" }
  });
  const baseUrl = (process.env.APP_URL || process.env.NEXTAUTH_URL || "").replace(/\/$/, "");

  return (
    <main className="p-4 lg:p-6">
      <h1 className="text-2xl font-bold">Tables</h1>
      <p className="mb-5 text-sm text-muted-foreground">Table QR links and quick bill-request status.</p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {tables.map((table) => {
          const qrUrl = baseUrl && table.qrUrl.startsWith("/") ? `${baseUrl}${table.qrUrl}` : table.qrUrl;
          const status = table.requests[0] ? "BILL_REQUESTED" : table.status;
          return (
            <Card key={table.id}>
              <CardHeader>
                <CardTitle>Table {table.tableNumber}</CardTitle>
                <StatusBadge status={status} />
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">QR URL</p>
                <TableQrImage url={qrUrl} tableNumber={table.tableNumber} restaurantName={restaurant.name} />
                <p className="mt-3 break-all text-sm font-medium">{qrUrl}</p>
                {table.requests[0] ? <p className="mt-2 text-sm font-semibold text-primary">Bill requested</p> : null}
                <CopyUrlButton url={qrUrl} />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </main>
  );
}
