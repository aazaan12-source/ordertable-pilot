"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { BellRing, Edit3, Eye, LayoutGrid, List, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { DirectPrintButton } from "@/components/dashboard/direct-print-button";
import { formatCurrency, formatPkTime } from "@/lib/utils";

const statuses = ["PENDING", "ACCEPTED", "PREPARING", "READY", "SERVED", "BILL_REQUESTED", "PAID", "CANCELLED"];
const announcedOrdersKey = "ordertable:announced-order-ids";
const orderViewModeKey = "ordertable:live-orders-view-mode";
const maxStoredOrderIds = 200;
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
  customerName?: string | null;
  waiterName?: string | null;
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

type WakeLockSentinelLike = {
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
};

export function LiveOrders({ initialOrders, initialStatus }: { initialOrders: Order[]; restaurantName: string; initialStatus?: string }) {
  const [orders, setOrders] = useState(initialOrders);
  const [active, setActive] = useState(statuses.includes(initialStatus || "") ? initialStatus! : "PENDING");
  const [viewMode, setViewMode] = useState<"cards" | "list">("list");
  const [newPending, setNewPending] = useState(false);
  const [warning, setWarning] = useState("");
  const [updating, setUpdating] = useState("");
  const seenPending = useRef(new Set(initialOrders.filter((order) => order.status === "PENDING").map((order) => order.id)));
  const ordersRef = useRef(initialOrders);
  const optimisticStatusRef = useRef(new Map<string, string>());
  const refreshRef = useRef({ inFlight: false, sequence: 0, queued: false });
  const wakeLock = useRef<WakeLockSentinelLike | null>(null);

  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  useEffect(() => {
    const storedViewMode = localStorage.getItem(orderViewModeKey);
    if (storedViewMode === "cards" || storedViewMode === "list") setViewMode(storedViewMode);
  }, []);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(announcedOrdersKey) || "[]") as string[];
      seenPending.current = new Set([...stored, ...initialOrders.filter((order) => order.status === "PENDING").map((order) => order.id)]);
      saveAnnouncedOrderIds();
    } catch {
      seenPending.current = new Set(initialOrders.filter((order) => order.status === "PENDING").map((order) => order.id));
    }
  }, [initialOrders]);

  function saveAnnouncedOrderIds() {
    const ids = Array.from(seenPending.current).slice(-maxStoredOrderIds);
    seenPending.current = new Set(ids);
    localStorage.setItem(announcedOrdersKey, JSON.stringify(ids));
  }

  function changeViewMode(nextViewMode: "cards" | "list") {
    setViewMode(nextViewMode);
    localStorage.setItem(orderViewModeKey, nextViewMode);
  }

  async function requestWakeLock() {
    if (document.hidden || wakeLock.current) return;
    try {
      const navigatorWithWakeLock = navigator as Navigator & {
        wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
      };
      wakeLock.current = await navigatorWithWakeLock.wakeLock?.request("screen") || null;
      wakeLock.current?.addEventListener("release", () => {
        wakeLock.current = null;
      });
    } catch {
      wakeLock.current = null;
    }
  }

  async function releaseWakeLock() {
    const lock = wakeLock.current;
    wakeLock.current = null;
    try {
      await lock?.release();
    } catch {
      // Browser may have released it already.
    }
  }

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
        saveAnnouncedOrderIds();
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
      timer = setTimeout(tick, document.hidden ? 3000 : 1200);
    };
    timer = setTimeout(tick, 700);
    const reconnect = () => void loadOrders();
    const wakeAndRefresh = () => {
      void requestWakeLock();
      void loadOrders();
    };
    window.addEventListener("online", reconnect);
    window.addEventListener("ordertable-network-online", reconnect);
    window.addEventListener("focus", wakeAndRefresh);
    document.addEventListener("visibilitychange", wakeAndRefresh);
    void requestWakeLock();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener("online", reconnect);
      window.removeEventListener("ordertable-network-online", reconnect);
      window.removeEventListener("focus", wakeAndRefresh);
      document.removeEventListener("visibilitychange", wakeAndRefresh);
      void releaseWakeLock();
    };
  }, []);

  async function updateStatus(orderId: string, status: string) {
    const previousActive = active;
    setUpdating(`${orderId}:${status}`);
    setActive(status);
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
        setActive(previousActive);
        setWarning(payload.error || "Could not update order. Retrying...");
        return;
      }
      void loadOrders();
    } catch {
      optimisticStatusRef.current.delete(orderId);
      setOrders(previousOrders);
      setActive(previousActive);
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

      <div id="live-order-tabs" className="scroll-mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {statuses.map((status) => (
            <Button key={status} variant={active === status ? "default" : "outline"} onClick={() => setActive(status)} className="shrink-0">
              {status.replaceAll("_", " ")} ({grouped[status]?.length || 0})
            </Button>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex rounded-md border bg-white p-1">
            <Button type="button" size="sm" variant={viewMode === "cards" ? "default" : "ghost"} onClick={() => changeViewMode("cards")}>
              <LayoutGrid className="h-4 w-4" />
              Cards
            </Button>
            <Button type="button" size="sm" variant={viewMode === "list" ? "default" : "ghost"} onClick={() => changeViewMode("list")}>
              <List className="h-4 w-4" />
              List
            </Button>
          </div>
          <Button variant="outline" onClick={loadOrders} className="shrink-0">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {viewMode === "list" ? (
        <OrderListView visible={visible} updating={updating} updateStatus={updateStatus} />
      ) : (
        <OrderCardView visible={visible} updating={updating} updateStatus={updateStatus} />
      )}
      {visible.length === 0 ? <p className="rounded-md border bg-white p-6 text-center text-muted-foreground">No orders in this status.</p> : null}
    </div>
  );
}

function OrderCardView({
  visible,
  updating,
  updateStatus
}: {
  visible: Order[];
  updating: string;
  updateStatus: (orderId: string, status: string) => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {visible.map((order) => {
        const hasBillRequest = hasPendingBillRequest(order);
        return (
          <Card key={order.id} className={order.status === "PENDING" ? "border-orange-300" : hasBillRequest ? "border-primary" : ""}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>{displayOrderTitle(order)}</CardTitle>
                  <p className="text-sm text-muted-foreground">{formatPkTime(order.createdAt)} - {sourceLabel(order.source)}</p>
                  {order.waiterName ? <p className="mt-1 text-sm font-semibold text-primary">Waiter: {order.waiterName}</p> : null}
                  {!order.waiterName && order.customerName ? <p className="mt-1 text-sm text-muted-foreground">Customer: {order.customerName}</p> : null}
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
                <p className="pt-1 text-muted-foreground">Payment: {order.paymentStatus}{order.paymentMethod ? ` - ${order.paymentMethod}` : ""}</p>
              </div>
              <OrderActions order={order} updating={updating} updateStatus={updateStatus} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function OrderListView({
  visible,
  updating,
  updateStatus
}: {
  visible: Order[];
  updating: string;
  updateStatus: (orderId: string, status: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="w-full min-w-[1120px] text-sm">
        <thead>
          <tr className="border-b bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="p-3">Order</th>
            <th className="p-3">Table</th>
            <th className="p-3">Source</th>
            <th className="p-3">Items</th>
            <th className="p-3 text-right">Total</th>
            <th className="p-3">Payment</th>
            <th className="p-3">Status</th>
            <th className="p-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((order) => {
            const hasBillRequest = hasPendingBillRequest(order);
            return (
              <tr key={order.id} className={order.status === "PENDING" ? "border-b bg-orange-50/45 align-top" : hasBillRequest ? "border-b bg-primary/5 align-top" : "border-b align-top"}>
                <td className="p-3">
                  <p className="font-bold">{displayOrderTitle(order)}</p>
                  <p className="text-xs text-muted-foreground">{formatPkTime(order.createdAt)}</p>
                  {order.waiterName ? <p className="text-xs font-semibold text-primary">Waiter: {order.waiterName}</p> : null}
                  {!order.waiterName && order.customerName ? <p className="text-xs text-muted-foreground">Customer: {order.customerName}</p> : null}
                </td>
                <td className="p-3 font-semibold">Table {order.table.tableNumber}</td>
                <td className="p-3">{sourceLabel(order.source)}</td>
                <td className="max-w-[340px] p-3">
                  <p className="font-medium">{itemsSummary(order)}</p>
                  {order.specialNote ? <p className="mt-1 text-xs text-muted-foreground">Note: {order.specialNote}</p> : null}
                  {hasBillRequest ? <p className="mt-1 text-xs font-semibold text-primary">Bill requested</p> : null}
                </td>
                <td className="p-3 text-right font-bold">{formatCurrency(order.total)}</td>
                <td className="p-3">{order.paymentStatus}{order.paymentMethod ? ` - ${order.paymentMethod}` : ""}</td>
                <td className="p-3"><StatusBadge status={order.status} /></td>
                <td className="p-3">
                  <OrderActions order={order} updating={updating} updateStatus={updateStatus} compact />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function OrderActions({
  order,
  updating,
  updateStatus,
  compact = false
}: {
  order: Order;
  updating: string;
  updateStatus: (orderId: string, status: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "flex max-w-[360px] flex-wrap gap-1.5" : "mt-4 flex flex-wrap gap-2"}>
      <Link href={`/dashboard/orders/${order.id}`}>
        <Button variant="outline" size={compact ? "sm" : "md"}>
          <Eye className="h-4 w-4" />
          View
        </Button>
      </Link>
      <Link href={`/dashboard/orders/${order.id}/edit`}>
        <Button variant="outline" size={compact ? "sm" : "md"}>
          <Edit3 className="h-4 w-4" />
          Edit
        </Button>
      </Link>
      <DirectPrintButton href={`/dashboard/orders/${order.id}/print/kitchen`} label={compact ? "Kitchen" : "Print Kitchen Slip"} size={compact ? "sm" : "md"} />
      <DirectPrintButton href={`/dashboard/orders/${order.id}/print/bill`} label={compact ? "Bill" : "Print Customer Bill"} type="bill" size={compact ? "sm" : "md"} />
      {(transitions[order.status] || []).map((action) => (
        <Button
          key={action.status}
          size={compact ? "sm" : "md"}
          variant={action.variant || "default"}
          disabled={updating === `${order.id}:${action.status}`}
          onClick={() => updateStatus(order.id, action.status)}
        >
          {updating === `${order.id}:${action.status}` ? "Updating..." : action.label}
        </Button>
      ))}
    </div>
  );
}

function hasPendingBillRequest(order: Order) {
  return order.waiterRequests?.some((request) => request.type === "BILL_REQUEST" && request.status === "PENDING");
}

function itemsSummary(order: Order) {
  const summary = order.items.slice(0, 3).map((item) => `${item.quantity}x ${item.itemName}`).join(", ");
  return order.items.length > 3 ? `${summary} +${order.items.length - 3} more` : summary;
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
  if (source === "WAITER_ASSISTED_QR") return "Waiter Assisted";
  return "Customer QR";
}

function displayOrderTitle(order: Order) {
  return /\bTable\s+\d+\b/i.test(order.orderNumber) ? order.orderNumber : `${order.orderNumber} - Table ${order.table.tableNumber}`;
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
