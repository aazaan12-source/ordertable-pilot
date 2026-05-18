"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { BellRing, Edit3, Eye, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { DirectPrintButton } from "@/components/dashboard/direct-print-button";
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

export function LiveOrders({ initialOrders, initialStatus }: { initialOrders: Order[]; restaurantName: string; initialStatus?: string }) {
  const [orders, setOrders] = useState(initialOrders);
  const [active, setActive] = useState(statuses.includes(initialStatus || "") ? initialStatus! : "PENDING");
  const [newPending, setNewPending] = useState(false);
  const [warning, setWarning] = useState("");
  const [updating, setUpdating] = useState("");
  const seenPending = useRef(new Set(initialOrders.filter((order) => order.status === "PENDING").map((order) => order.id)));
  const ordersRef = useRef(initialOrders);
  const optimisticStatusRef = useRef(new Map<string, string>());
  const refreshRef = useRef({ inFlight: false, sequence: 0, queued: false });

  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  function applyOptimisticStatuses(nextOrders: Order[]) {
    return nextOrders.map((order) => {
      const optimisticStatus = optimisticStatusRef.current.get(order.id);
      if (!optimisticStatus) return order;
      if (order.status === optimisticStatus) {
        optimisticStatusRef.current.delete(order.id);
        return order;
      }
      return {
        ...order,
        status: optimisticStatus,
        paymentStatus: optimisticStatus === "PAID" ? "PAID" : order.paymentStatus,
        paymentMethod: optimisticStatus === "PAID" ? order.paymentMethod || "CASH" : order.paymentMethod
      };
    });
  }

  async function loadOrders() {
    if (refreshRef.current.inFlight) {
      refreshRef.current.queued = true;
      return;
    }
    refreshRef.current.inFlight = true;
    const sequence = ++refreshRef.current.sequence;
    try {
      const response = await fetch("/api/dashboard/orders", { cache: "no-store" });
      if (!response.ok) throw new Error("orders failed");
      const data = await response.json();
      if (sequence !== refreshRef.current.sequence) return;
      const nextOrders = applyOptimisticStatuses(data.orders);
      const nextPending = nextOrders.filter((order) => order.status === "PENDING");
      const freshPending = nextPending.filter((order) => !seenPending.current.has(order.id));
      if (freshPending.length > 0) {
        setNewPending(true);
        playNotification();
        speakNewOrder(freshPending.at(-1)?.table.tableNumber);
        nextPending.forEach((order) => seenPending.current.add(order.id));
      }
      setOrders(nextOrders);
      setWarning("");
    } catch {
      setWarning("Connection issue. Retrying...");
    } finally {
      const queued = refreshRef.current.queued;
      refreshRef.current.queued = false;
      refreshRef.current.inFlight = false;
      if (queued) void loadOrders();
    }
  }

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      await loadOrders();
      if (cancelled) return;
      timer = setTimeout(tick, document.hidden ? 2500 : 700);
    };
    timer = setTimeout(tick, 700);
    const reconnect = () => void loadOrders();
    window.addEventListener("online", reconnect);
    window.addEventListener("ordertable-network-online", reconnect);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener("online", reconnect);
      window.removeEventListener("ordertable-network-online", reconnect);
    };
  }, []);

  async function updateStatus(orderId: string, status: string) {
    setUpdating(`${orderId}:${status}`);
    optimisticStatusRef.current.set(orderId, status);
    const previousOrders = ordersRef.current;
    const paymentMethod = status === "PAID" ? "CASH" : undefined;
    setOrders((current) =>
      current.map((order) =>
        order.id === orderId
          ? {
              ...order,
              status,
              paymentStatus: status === "PAID" ? "PAID" : order.paymentStatus,
              paymentMethod: paymentMethod || order.paymentMethod
            }
          : order
      )
    );
    setWarning("");
    try {
      const response = await fetch(`/api/dashboard/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, paymentMethod })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        optimisticStatusRef.current.delete(orderId);
        setOrders(previousOrders);
        setWarning(payload.error || "Could not update order. Retrying...");
        return;
      }
      void loadOrders();
    } catch {
      optimisticStatusRef.current.delete(orderId);
      setOrders(previousOrders);
      setWarning("Connection issue. Action was not saved. Retrying...");
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

      <div id="live-order-tabs" className="scroll-mt-4 flex items-center justify-between gap-3">
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
                        <span>{formatCurrency(item.totalPrice)}</span>
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
                  <DirectPrintButton href={`/dashboard/orders/${order.id}/print/kitchen`} label="Print Kitchen Slip" />
                  <DirectPrintButton href={`/dashboard/orders/${order.id}/print/bill`} label="Print Customer Bill" type="bill" />
                  {(transitions[order.status] || []).map((action) => (
                    <Button
                      key={action.status}
                      variant={action.variant || "default"}
                      disabled={updating === `${order.id}:${action.status}`}
                      onClick={() => updateStatus(order.id, action.status)}
                    >
                      {updating === `${order.id}:${action.status}` ? "Updating..." : action.label}
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
      <span>{formatCurrency(value)}</span>
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

function speakNewOrder(tableNumber?: number) {
  if (!tableNumber || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(`New Order from Table no. ${tableNumber}, please proceed it`);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Visual and bell alerts still work if browser speech is blocked.
  }
}
