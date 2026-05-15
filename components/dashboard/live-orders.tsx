"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { BellRing, Edit3, Eye, Printer, Receipt, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { FinancialAmount } from "@/components/dashboard/financial-amount";
import { formatCurrency, formatPkTime } from "@/lib/utils";

const statuses = ["PENDING", "ACCEPTED", "PREPARING", "READY", "SERVED", "BILL_REQUESTED", "PAID", "CANCELLED"];
const transitions: Record<string, { label: string; status: string; variant?: "default" | "destructive" | "outline" | "secondary" }[]> = {
  PENDING: [
    { label: "Accept", status: "ACCEPTED" },
    { label: "Cancel", status: "CANCELLED", variant: "destructive" }
  ],
  ACCEPTED: [
    { label: "Preparing", status: "PREPARING" },
    { label: "Cancel", status: "CANCELLED", variant: "destructive" }
  ],
  PREPARING: [{ label: "Ready", status: "READY" }],
  READY: [{ label: "Served", status: "SERVED" }],
  SERVED: [
    { label: "Bill Requested", status: "BILL_REQUESTED", variant: "secondary" },
    { label: "Paid", status: "PAID" }
  ],
  BILL_REQUESTED: [{ label: "Paid", status: "PAID" }]
};

type Order = {
  id: string;
  orderNumber: string;
  status: string;
  source: string;
  subtotal: string;
  serviceCharges: string;
  tax: string;
  discount: string;
  total: string;
  paymentStatus: string;
  paymentMethod?: string | null;
  specialNote: string | null;
  createdAt: string;
  table: { tableNumber: number };
  waiterRequests?: { id: string; type: string; status: string }[];
  items: {
    id: string;
    itemName: string;
    quantity: number;
    unitPrice: string;
    specialInstruction: string | null;
    totalPrice: string;
  }[];
};

export function LiveOrders({ initialOrders }: { initialOrders: Order[]; restaurantName: string }) {
  const [orders, setOrders] = useState(initialOrders);
  const [active, setActive] = useState("PENDING");
  const [newPending, setNewPending] = useState(false);
  const [warning, setWarning] = useState("");
  const [updating, setUpdating] = useState("");
  const seenPending = useRef(new Set(initialOrders.filter((order) => order.status === "PENDING").map((order) => order.id)));

  async function loadOrders() {
    try {
      const response = await fetch("/api/dashboard/orders", { cache: "no-store" });
      if (!response.ok) throw new Error("orders failed");
      const data = await response.json();
      const nextOrders: Order[] = data.orders;
      const nextPending = nextOrders.filter((order) => order.status === "PENDING");
      if (nextPending.some((order) => !seenPending.current.has(order.id))) {
        setNewPending(true);
        playNotification();
        nextPending.forEach((order) => seenPending.current.add(order.id));
      }
      setOrders(nextOrders);
      setWarning("");
    } catch {
      setWarning("Connection issue. Retrying...");
    }
  }

  useEffect(() => {
    const timer = setInterval(loadOrders, 1000);
    return () => clearInterval(timer);
  }, []);

  async function updateStatus(orderId: string, status: string) {
    setUpdating(`${orderId}:${status}`);
    try {
      const response = await fetch(`/api/dashboard/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, paymentMethod: status === "PAID" ? "CASH" : undefined })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setWarning(payload.error || "Could not update order. Retrying...");
        return;
      }
      await loadOrders();
    } finally {
      setUpdating("");
    }
  }

  const grouped = useMemo(() => {
    return statuses.reduce<Record<string, Order[]>>((acc, status) => {
      acc[status] = orders.filter((order) => order.status === status);
      return acc;
    }, {});
  }, [orders]);

  const visible = grouped[active] || [];

  return (
    <div className="space-y-5">
      {warning ? <p className="rounded-md border border-orange-300 bg-orange-50 p-3 text-sm font-medium text-orange-900">{warning}</p> : null}
      {newPending ? (
        <button onClick={() => setNewPending(false)} className="flex w-full items-center gap-3 rounded-md border border-orange-300 bg-orange-50 p-3 text-left font-semibold text-orange-900">
          <BellRing className="h-5 w-5" />
          New pending order received
        </button>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {statuses.map((status) => (
            <Button key={status} variant={active === status ? "default" : "outline"} onClick={() => setActive(status)} className="shrink-0">
              {status.replaceAll("_", " ")} ({grouped[status]?.length || 0})
            </Button>
          ))}
        </div>
        <Button variant="outline" onClick={loadOrders} className="shrink-0">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {visible.map((order) => {
          const hasBillRequest = order.waiterRequests?.some((request) => request.type === "BILL_REQUEST" && request.status === "PENDING");
          return (
            <Card key={order.id} className={order.status === "PENDING" ? "border-orange-300" : hasBillRequest ? "border-primary" : ""}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{order.orderNumber} - Table {order.table.tableNumber}</CardTitle>
                    <p className="text-sm text-muted-foreground">{formatPkTime(order.createdAt)} · {sourceLabel(order.source)}</p>
                    {hasBillRequest ? <p className="mt-1 text-sm font-semibold text-primary">Bill requested</p> : null}
                  </div>
                  <StatusBadge status={order.status} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {order.items.map((item) => (
                    <div key={item.id} className="rounded-md bg-muted p-3">
                      <div className="flex justify-between gap-3 font-medium">
                        <span>{item.quantity} x {item.itemName}</span>
                        <FinancialAmount value={item.totalPrice} fallback={formatCurrency(item.totalPrice)} />
                      </div>
                      <p className="text-sm text-muted-foreground">{formatCurrency(item.unitPrice)} x {item.quantity}</p>
                      {item.specialInstruction ? <p className="mt-1 text-sm text-muted-foreground">Note: {item.specialInstruction}</p> : null}
                    </div>
                  ))}
                </div>
                {order.specialNote ? <p className="mt-3 rounded-md border p-3 text-sm">Order note: {order.specialNote}</p> : null}
                <div className="mt-4 space-y-1 rounded-md border p-3 text-sm">
                  <BillRow label="Subtotal" value={order.subtotal} />
                  <BillRow label="Service Charges" value={order.serviceCharges} />
                  <BillRow label="Tax" value={order.tax} />
                  <BillRow label="Discount" value={order.discount} />
                  <div className="border-t pt-2">
                    <BillRow label="Total" value={order.total} strong />
                  </div>
                  <p className="pt-1 text-muted-foreground">Payment: {order.paymentStatus}{order.paymentMethod ? ` · ${order.paymentMethod}` : ""}</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/dashboard/orders/${order.id}`}>
                    <Button variant="outline">
                      <Eye className="h-4 w-4" />
                      View
                    </Button>
                  </Link>
                  <Link href={`/dashboard/orders/${order.id}/edit`}>
                    <Button variant="outline">
                      <Edit3 className="h-4 w-4" />
                      Edit
                    </Button>
                  </Link>
                  <Link href={`/dashboard/orders/${order.id}/print/kitchen`} target="_blank">
                    <Button variant="outline">
                      <Printer className="h-4 w-4" />
                      Print Kitchen Slip
                    </Button>
                  </Link>
                  <Link href={`/dashboard/orders/${order.id}/print/bill`} target="_blank">
                    <Button variant="outline">
                      <Receipt className="h-4 w-4" />
                      Print Customer Bill
                    </Button>
                  </Link>
                  {(transitions[order.status] || []).map((action) => (
                    <Button
                      key={action.status}
                      variant={action.variant || "default"}
                      disabled={updating === `${order.id}:${action.status}`}
                      onClick={() => updateStatus(order.id, action.status)}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {visible.length === 0 ? <p className="rounded-md border bg-white p-6 text-center text-muted-foreground">No orders in this status.</p> : null}
    </div>
  );
}

function BillRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? "flex justify-between gap-3 text-lg font-bold" : "flex justify-between gap-3"}>
      <span>{label}</span>
      <FinancialAmount value={value} fallback={formatCurrency(value)} />
    </div>
  );
}

function sourceLabel(source: string) {
  if (source === "MANUAL_DASHBOARD") return "Manual";
  if (source === "WAITER_ENTRY") return "Waiter Entry";
  return "Online QR";
}

function playNotification() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.frequency.value = 880;
    gain.gain.value = 0.04;
    oscillator.start();
    oscillator.stop(context.currentTime + 0.16);
  } catch {
    // Browser audio can be blocked until user interaction; visual alert still appears.
  }
}
