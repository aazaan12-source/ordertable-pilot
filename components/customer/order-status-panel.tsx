"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Pencil, ReceiptText, RefreshCw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { RequestButtons } from "@/components/customer/request-buttons";
import { FeedbackForm } from "@/components/customer/feedback-form";
import { formatCurrency, formatPkDateTime } from "@/lib/utils";

type OrderSnapshot = {
  id: string;
  orderNumber: string;
  status: string;
  statusLabel: string;
  paymentStatus: string;
  specialNote: string | null;
  subtotal: string;
  serviceCharges: string;
  tax: string;
  discount: string;
  total: string;
  createdAt: string;
  cancelInfo: {
    canCancel: boolean;
    expiresAt: string;
    remainingSeconds: number;
    reason: string | null;
  };
  restaurant: {
    name: string;
    branchName: string;
    city: string;
    customerCancelWindowMinutes: number;
  };
  table: { tableNumber: number };
  items: {
    id: string;
    itemName: string;
    quantity: number;
    unitPrice: string;
    totalPrice: string;
    specialInstruction: string | null;
  }[];
};

export function OrderStatusPanel({ initialOrder }: { initialOrder: OrderSnapshot }) {
  const [order, setOrder] = useState(initialOrder);
  const [warning, setWarning] = useState("");
  const [message, setMessage] = useState("");
  const [statusNotice, setStatusNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastStatus, setLastStatus] = useState(initialOrder.status);

  async function loadOrder(silent = false) {
    try {
      const response = await fetch(`/api/customer/orders/${order.id}`, { cache: "no-store" });
      if (!response.ok) throw new Error("status failed");
      const payload = await response.json();
      const nextOrder = payload.order as OrderSnapshot;
      if (nextOrder.status !== lastStatus) {
        setStatusNotice(`Order status updated to ${nextOrder.statusLabel}. Tap here to view the latest order status.`);
        setLastStatus(nextOrder.status);
      }
      setOrder(nextOrder);
      setWarning("");
    } catch {
      if (!silent) setWarning("Connection issue. Retrying...");
    }
  }

  useEffect(() => {
    const timer = setInterval(() => loadOrder(true), 1000);
    return () => clearInterval(timer);
  }, [order.id]);

  async function cancelOrder() {
    if (!confirm("Cancel this order?")) return;
    setLoading(true);
    setMessage("");
    const response = await fetch(`/api/customer/orders/${order.id}`, { method: "DELETE" });
    const payload = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setMessage(payload.error || "Could not cancel this order.");
      await loadOrder(true);
      return;
    }
    setMessage("Order cancelled.");
    await loadOrder(true);
  }

  const cancelText = useMemo(() => {
    if (order.cancelInfo.canCancel) {
      const seconds = Math.max(0, order.cancelInfo.remainingSeconds);
      const minutes = Math.floor(seconds / 60);
      const rest = String(seconds % 60).padStart(2, "0");
      return `You can cancel this order within ${order.restaurant.customerCancelWindowMinutes} minutes if the kitchen has not started preparing it. Time left: ${minutes}:${rest}`;
    }
    if (order.cancelInfo.reason === "expired") return "Cancellation time has expired. Please call waiter.";
    if (order.cancelInfo.reason === "kitchen_started") return "This order is already being prepared. Please call waiter.";
    return "This order can no longer be cancelled.";
  }, [order]);

  return (
    <main className="mx-auto min-h-screen max-w-xl px-4 py-8">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>{order.orderNumber}</CardTitle>
              <p className="text-sm text-muted-foreground">{order.restaurant.name} - Table {order.table.tableNumber}</p>
              <p className="text-xs text-muted-foreground">{formatPkDateTime(order.createdAt)}</p>
            </div>
            <StatusBadge status={order.status} />
          </div>
        </CardHeader>
        <CardContent>
          {warning ? <p className="mb-3 rounded-md border border-orange-300 bg-orange-50 p-3 text-sm text-orange-900">{warning}</p> : null}
          {statusNotice ? (
            <button
              type="button"
              onClick={() => {
                setStatusNotice("");
                void loadOrder();
              }}
              className="mb-3 w-full rounded-md border border-primary bg-primary/10 p-3 text-left text-sm font-semibold text-primary"
            >
              {statusNotice}
            </button>
          ) : null}
          <div className="rounded-md bg-muted p-4">
            <p className="text-sm text-muted-foreground">Current status</p>
            <p className="text-2xl font-bold">{order.statusLabel}</p>
            <p className="mt-1 text-sm">Payment: <strong>{order.paymentStatus}</strong></p>
          </div>

          <div className="mt-5 space-y-3">
            {order.items.map((item) => (
              <div key={item.id} className="rounded-md bg-muted p-3 text-sm">
                <div className="flex justify-between gap-3 font-medium">
                  <span>{item.quantity} x {item.itemName}</span>
                  <span>{formatCurrency(item.totalPrice)}</span>
                </div>
                <p className="mt-1 text-muted-foreground">{formatCurrency(item.unitPrice)} x {item.quantity}</p>
                {item.specialInstruction ? <p className="mt-1 text-muted-foreground">Note: {item.specialInstruction}</p> : null}
              </div>
            ))}
          </div>

          {order.specialNote ? <p className="mt-4 rounded-md border p-3 text-sm">Order note: {order.specialNote}</p> : null}

          <div className="mt-5 space-y-2 rounded-md border p-3 text-sm">
            <BillRow label="Subtotal" value={order.subtotal} />
            <BillRow label="Service Charges" value={order.serviceCharges} />
            <BillRow label="Tax" value={order.tax} />
            <BillRow label="Discount" value={order.discount} />
            <div className="border-t pt-2">
              <BillRow label="Final Total" value={order.total} strong />
            </div>
          </div>

          <div className="mt-5 rounded-md bg-muted p-3 text-sm">{cancelText}</div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={() => loadOrder()}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            {order.status === "PENDING" ? (
              <Link href={`/order/${order.id}/edit`}>
                <Button variant="outline" className="w-full">
                  <Pencil className="h-4 w-4" />
                  Edit Order
                </Button>
              </Link>
            ) : null}
            {order.cancelInfo.canCancel ? (
              <Button variant="destructive" onClick={cancelOrder} disabled={loading} className="col-span-2">
                <XCircle className="h-4 w-4" />
                Cancel Order
              </Button>
            ) : null}
          </div>
          {message ? <p className="mt-3 text-sm text-muted-foreground">{message}</p> : null}

          {order.status === "SERVED" && order.paymentStatus === "UNPAID" ? (
            <div className="mt-5 animate-pulse rounded-lg border-2 border-primary bg-primary/10 p-4 text-center">
              <ReceiptText className="mx-auto h-8 w-8 text-primary" />
              <h2 className="mt-2 text-xl font-black">Ready for bill?</h2>
              <p className="mt-1 text-sm text-muted-foreground">Your order is served. Ask for the bill when you are ready.</p>
            </div>
          ) : null}

          <RequestButtons orderId={order.id} />
          <FeedbackForm orderId={order.id} />
        </CardContent>
      </Card>
    </main>
  );
}

function BillRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? "flex justify-between gap-3 text-lg font-bold" : "flex justify-between gap-3"}>
      <span>{label}</span>
      <span>{formatCurrency(value)}</span>
    </div>
  );
}
