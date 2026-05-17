import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { markOrderPaid, updateOrderStatusFromDetail } from "@/lib/dashboard-order-actions";
import { getManagerRestaurant } from "@/lib/permissions";
import { orderSourceLabels } from "@/lib/order-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { DirectPrintButton } from "@/components/dashboard/direct-print-button";
import { formatCurrency, formatPkDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const nextActions: Record<string, { label: string; status: string }[]> = {
  PENDING: [{ label: "Accept", status: "ACCEPTED" }, { label: "Cancel", status: "CANCELLED" }],
  ACCEPTED: [{ label: "Preparing", status: "PREPARING" }, { label: "Cancel", status: "CANCELLED" }],
  PREPARING: [{ label: "Ready", status: "READY" }],
  READY: [{ label: "Served", status: "SERVED" }],
  SERVED: [{ label: "Bill Requested", status: "BILL_REQUESTED" }],
  BILL_REQUESTED: []
};

export default async function DashboardOrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { restaurant } = await getManagerRestaurant();
  const { orderId } = await params;
  const order = await db.order.findFirst({
    where: { id: orderId, restaurantId: restaurant.id },
    include: { table: true, items: true, restaurant: true }
  });
  if (!order) notFound();
  const sourceLabel = orderSourceLabels[order.source];

  return (
    <main className="p-4 lg:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{order.orderNumber}</h1>
          <p className="text-sm text-muted-foreground">Table {order.table.tableNumber} · {sourceLabel} · {formatPkDateTime(order.createdAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/orders"><Button variant="outline">Back to Orders</Button></Link>
          <Link href={`/dashboard/orders/${order.id}/edit`}><Button>Edit Order/Bill</Button></Link>
          <DirectPrintButton href={`/dashboard/orders/${order.id}/print/kitchen`} label="Print Kitchen Slip" />
          <DirectPrintButton href={`/dashboard/orders/${order.id}/print/kitchen?addedOnly=1`} label="Print Added Items" />
          <DirectPrintButton href={`/dashboard/orders/${order.id}/print/bill`} label="Print Customer Bill" type="bill" />
        </div>
      </div>

      {order.status === "PAID" ? <p className="mb-4 rounded-md border border-orange-300 bg-orange-50 p-3 text-sm text-orange-950">This order is already paid. Editing it will affect financial records.</p> : null}
      {order.status === "CANCELLED" ? <p className="mb-4 rounded-md border bg-muted p-3 text-sm">Cancelled orders cannot be edited.</p> : null}

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Order Items</CardTitle>
              <StatusBadge status={order.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {order.items.map((item) => (
              <div key={item.id} className="rounded-md border p-3">
                <div className="flex justify-between gap-3 font-semibold">
                  <span>{item.quantity} x {item.itemName}{item.addedAfterInitialOrder ? " (Added later)" : ""}</span>
                  <span>{formatCurrency(item.totalPrice.toString())}</span>
                </div>
                <p className="text-sm text-muted-foreground">{formatCurrency(item.unitPrice.toString())} x {item.quantity}</p>
                {item.specialInstruction ? <p className="mt-1 text-sm text-muted-foreground">Note: {item.specialInstruction}</p> : null}
              </div>
            ))}
            {order.specialNote ? <p className="rounded-md border p-3 text-sm">Order note: {order.specialNote}</p> : null}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle>Bill Summary</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <BillLine label="Subtotal" value={order.subtotal.toString()} />
              <BillLine label="Discount" value={order.discount.toString()} />
              <BillLine label="Service Charges" value={order.serviceCharges.toString()} />
              <BillLine label="Tax" value={order.tax.toString()} />
              <div className="border-t pt-2">
                <BillLine label="Grand Total" value={order.total.toString()} strong />
              </div>
              <p className="pt-2 text-muted-foreground">Payment: {order.paymentStatus} {order.paymentMethod ? `· ${order.paymentMethod}` : ""}</p>
              <p className="text-muted-foreground">Customer: {order.customerName || "Not provided"} {order.customerPhone ? `· ${order.customerPhone}` : ""}</p>
              <p className="text-muted-foreground">Waiter: {order.waiterName || "Not provided"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {(nextActions[order.status] || []).map((action) => (
                <form key={action.status} action={updateOrderStatusFromDetail}>
                  <input type="hidden" name="orderId" value={order.id} />
                  <input type="hidden" name="status" value={action.status} />
                  <Button className="w-full" variant={action.status === "CANCELLED" ? "destructive" : "default"}>{action.label}</Button>
                </form>
              ))}
              {order.status !== "PAID" && order.status !== "CANCELLED" ? (
                <form action={markOrderPaid} className="grid gap-2">
                  <input type="hidden" name="orderId" value={order.id} />
                  <select name="paymentMethod" className="h-10 rounded-md border bg-white px-3 text-sm" defaultValue={order.paymentMethod || "CASH"}>
                    <option value="CASH">Cash</option>
                    <option value="CARD">Card</option>
                    <option value="JAZZCASH">JazzCash</option>
                    <option value="EASYPAISA">EasyPaisa</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="OTHER">Other</option>
                  </select>
                  <Button className="w-full">Mark Paid</Button>
                </form>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

function BillLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? "flex justify-between gap-3 text-base font-bold" : "flex justify-between gap-3"}>
      <span>{label}</span>
      <span>{formatCurrency(value)}</span>
    </div>
  );
}
