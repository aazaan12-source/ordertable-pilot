import { db } from "@/lib/db";
import { getManagerRestaurant } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { CopyUrlButton } from "@/components/dashboard/copy-url-button";
import { TableQrImage } from "@/components/dashboard/table-qr-image";
import { FinancialAmount } from "@/components/dashboard/financial-amount";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function TablesPage() {
  const { restaurant } = await getManagerRestaurant();
  const tables = await db.restaurantTable.findMany({
    where: { restaurantId: restaurant.id },
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        take: 1
      },
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
      <p className="mb-5 text-sm text-muted-foreground">Table-wise current orders, bill requests, QR links, and payment state.</p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {tables.map((table) => {
          const latestOrder = table.orders[0];
          const qrUrl = baseUrl && table.qrUrl.startsWith("/") ? `${baseUrl}${table.qrUrl}` : table.qrUrl;
          const status = table.requests[0]
            ? "BILL_REQUESTED"
            : table.status === "PAID" && latestOrder?.status === "PAID"
              ? "EMPTY"
              : table.status;
          return (
            <Card key={table.id}>
              <CardHeader>
                <CardTitle>Table {table.tableNumber}</CardTitle>
                <StatusBadge status={status} />
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">QR URL</p>
                <TableQrImage url={qrUrl} />
                <p className="mt-3 break-all text-sm font-medium">{qrUrl}</p>
                {latestOrder ? (
                  <div className="mt-3 space-y-1 text-sm">
                    <p>Latest order: <strong>{latestOrder.orderNumber}</strong></p>
                    <p className="text-muted-foreground">Status: {latestOrder.status.replaceAll("_", " ")}</p>
                    <p className="text-muted-foreground">Payment: {latestOrder.paymentStatus}</p>
                    <p className="font-semibold">Bill: <FinancialAmount value={latestOrder.total.toString()} /></p>
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Link href={`/dashboard/orders/${latestOrder.id}`}><Button size="sm" variant="outline">View</Button></Link>
                      <Link href={`/dashboard/orders/${latestOrder.id}/edit`}><Button size="sm" variant="outline">Edit Bill</Button></Link>
                      <Link href={`/dashboard/orders/${latestOrder.id}/print/bill`} target="_blank"><Button size="sm" variant="outline">Print Bill</Button></Link>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">No order yet</p>
                )}
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
