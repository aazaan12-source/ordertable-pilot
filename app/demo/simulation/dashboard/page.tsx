"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BellRing, CheckCircle2, ClipboardList, Lock, ReceiptText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatPkDateTime } from "@/lib/utils";
import {
  DemoOrder,
  DemoOrderStatus,
  DemoRequest,
  demoStatusActions,
  demoStatusLabels,
  demoStatuses,
  emptyDemoState,
  listenDemoState,
  loadDemoState,
  saveDemoState
} from "@/components/public/demo-simulation-store";

export default function DemoSimulationDashboardPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#f6f7f4] p-6">Loading demo dashboard...</main>}>
      <DemoSimulationDashboardContent />
    </Suspense>
  );
}

function DemoSimulationDashboardContent() {
  const params = useSearchParams();
  const session = params.get("session") || "public-demo";
  const [state, setState] = useState(emptyDemoState);
  const [active, setActive] = useState<DemoOrderStatus>("PENDING");
  const announcedRequests = useRef<Set<string>>(new Set());

  function refresh() {
    setState(loadDemoState(session));
  }

  useEffect(() => {
    refresh();
    return listenDemoState(session, refresh);
  }, [session]);

  useEffect(() => {
    const nextRequest = state.requests.find((request) => request.status === "PENDING" && !announcedRequests.current.has(request.id));
    if (!nextRequest || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    announcedRequests.current.add(nextRequest.id);
    const text = nextRequest.type === "CALL_WAITER"
      ? `Demo call waiter from table number ${nextRequest.tableNumber}`
      : `Demo bill request from table number ${nextRequest.tableNumber}`;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }, [state.requests]);

  const activeOrders = useMemo(() => state.orders.filter((order) => order.status === active), [state.orders, active]);
  const pendingRequests = state.requests.filter((request) => request.status === "PENDING");
  const paidCount = state.orders.filter((order) => order.status === "PAID").length;
  const totalRevenue = state.orders.filter((order) => order.status === "PAID").reduce((sum, order) => sum + order.total, 0);

  function updateStatus(orderId: string, status: DemoOrderStatus) {
    const previousActive = active;
    const remainingInCurrentTab = state.orders.filter((order) => order.status === previousActive && order.id !== orderId).length;
    const nextState = {
      ...state,
      orders: state.orders.map((order) => order.id === orderId
        ? { ...order, status, paymentStatus: status === "PAID" ? "PAID" as const : order.paymentStatus }
        : order)
    };
    saveDemoState(session, nextState);
    setState(nextState);
    setActive(remainingInCurrentTab === 0 ? status : previousActive);
  }

  function resolveRequest(requestId: string) {
    const nextState = {
      ...state,
      requests: state.requests.map((request) => request.id === requestId ? { ...request, status: "RESOLVED" as const } : request)
    };
    saveDemoState(session, nextState);
    setState(nextState);
  }

  function resetDemo() {
    const nextState = emptyDemoState();
    saveDemoState(session, nextState);
    setState(nextState);
    setActive("PENDING");
  }

  return (
    <main className="min-h-screen bg-[#f6f7f4]">
      <header className="sticky top-0 z-20 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">Public demo simulation</p>
            <h1 className="text-2xl font-black">Demo Restaurant Live Orders</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/#demo-simulation"><Button variant="outline">Demo QR Codes</Button></Link>
            <Button variant="outline" onClick={refresh}><RefreshCw className="h-4 w-4" />Refresh</Button>
            <Button variant="outline" onClick={resetDemo}>Reset Demo</Button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-5 md:grid-cols-4">
        <Stat title="Live orders" value={state.orders.filter((order) => order.status !== "PAID" && order.status !== "CANCELLED").length} />
        <Stat title="Pending requests" value={pendingRequests.length} />
        <Stat title="Paid orders" value={paidCount} />
        <Stat title="Demo revenue" value={formatCurrency(totalRevenue)} />
      </section>

      <section className="mx-auto grid max-w-6xl gap-5 px-4 pb-10 lg:grid-cols-[1fr_330px]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-primary" />Live Order Tab</CardTitle>
              <p className="text-sm text-muted-foreground">This demo shows only the live order workflow. Other dashboard modules are locked previews.</p>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {demoStatuses.map((status) => {
                  const count = state.orders.filter((order) => order.status === status).length;
                  return (
                    <button
                      key={status}
                      onClick={() => setActive(status)}
                      className={`shrink-0 rounded-md border px-3 py-2 text-sm font-bold ${active === status ? "border-primary bg-primary text-white" : "bg-white hover:bg-muted"}`}
                    >
                      {demoStatusLabels[status]} <span className="ml-1 rounded bg-black/10 px-1.5 py-0.5 text-xs">{count}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 space-y-3">
                {activeOrders.length === 0 ? (
                  <div className="rounded-lg border border-dashed bg-white p-8 text-center text-muted-foreground">
                    No demo orders in {demoStatusLabels[active]}.
                  </div>
                ) : activeOrders.map((order) => (
                  <OrderCard key={order.id} order={order} onUpdate={updateStatus} />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BellRing className="h-5 w-5 text-primary" />Waiter & Bill Requests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingRequests.length === 0 ? (
                <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">No pending demo requests.</p>
              ) : pendingRequests.map((request) => (
                <RequestRow key={request.id} request={request} onResolve={resolveRequest} />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Read-only modules</CardTitle></CardHeader>
            <CardContent className="grid gap-2 text-sm">
              {["Menu Management", "QR Codes", "Reports", "Settings"].map((item) => (
                <div key={item} className="flex items-center justify-between rounded-md border bg-muted px-3 py-2 text-muted-foreground">
                  <span>{item}</span>
                  <Lock className="h-4 w-4" />
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="rounded-lg bg-[#103a31]/90 p-3 text-xs leading-5 text-white shadow-lg backdrop-blur">
            Open a demo table order page, place an order, then use these status buttons exactly like a restaurant counter would.
          </div>
        </aside>
      </section>
    </main>
  );
}

function OrderCard({ order, onUpdate }: { order: DemoOrder; onUpdate: (orderId: string, status: DemoOrderStatus) => void }) {
  const actions = demoStatusActions[order.status] || [];
  return (
    <Card className="border-l-4 border-l-primary">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-black">{order.orderNumber} - Table {order.tableNumber}</h3>
            <p className="text-sm text-muted-foreground">
              {order.source}
              {order.waiterName ? ` | Waiter: ${order.waiterName}` : ""}
              {order.customerName ? ` | Customer: ${order.customerName}` : ""}
            </p>
            <p className="text-xs text-muted-foreground">{formatPkDateTime(new Date(order.createdAt))}</p>
          </div>
          <span className="rounded-md bg-primary/10 px-3 py-1 text-sm font-bold text-primary">{demoStatusLabels[order.status]}</span>
        </div>

        <div className="mt-4 grid gap-2">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 rounded-md bg-muted px-3 py-2 text-sm">
              <span className="font-semibold">{item.quantity} x {item.name}</span>
              <span>{formatCurrency(item.price * item.quantity)}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xl font-black">{formatCurrency(order.total)}</p>
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <Button
                key={action.next}
                onClick={() => onUpdate(order.id, action.next)}
                variant={action.tone === "danger" ? "destructive" : action.tone === "success" ? "default" : "outline"}
              >
                {action.label}
              </Button>
            ))}
            {order.status === "PAID" ? <span className="flex items-center gap-1 rounded-md bg-primary/10 px-3 py-2 text-sm font-bold text-primary"><CheckCircle2 className="h-4 w-4" />Paid</span> : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RequestRow({ request, onResolve }: { request: DemoRequest; onResolve: (id: string) => void }) {
  const label = request.type === "CALL_WAITER" ? "Call Waiter" : "Ask for Bill";
  const Icon = request.type === "CALL_WAITER" ? BellRing : ReceiptText;
  return (
    <div className="rounded-md border bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-bold"><Icon className="h-4 w-4 text-primary" />{label}</p>
          <p className="text-sm text-muted-foreground">Table {request.tableNumber}</p>
        </div>
        <Button size="sm" onClick={() => onResolve(request.id)}>Acknowledge</Button>
      </div>
    </div>
  );
}

function Stat({ title, value }: { title: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{title}</CardTitle></CardHeader>
      <CardContent><p className="text-2xl font-black">{value}</p></CardContent>
    </Card>
  );
}
