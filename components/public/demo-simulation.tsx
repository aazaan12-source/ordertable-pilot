"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BellRing, CheckCircle2, ClipboardList, Lock, QrCode, ReceiptText, ScanLine, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import {
  DemoOrder,
  DemoOrderStatus,
  DemoRequest,
  DemoState,
  demoStatusActions,
  demoStatusLabels,
  demoStatuses,
  emptyDemoState
} from "@/components/public/demo-simulation-store";

type DemoQr = {
  tableNumber: number;
  url: string;
  dataUrl: string;
};

const session = "public-demo";

export function DemoSimulation({ qrCodes }: { qrCodes: DemoQr[] }) {
  const [state, setState] = useState<DemoState>(emptyDemoState);
  const [active, setActive] = useState<DemoOrderStatus>("PENDING");
  const [attention, setAttention] = useState(false);
  const knownPending = useRef(0);
  const initialized = useRef(false);
  const announcedRequests = useRef<Set<string>>(new Set());
  const clearPaidTimer = useRef<number | null>(null);
  const [completionMessage, setCompletionMessage] = useState("");

  async function loadState() {
    try {
      const response = await fetch(`/api/demo-simulation/state?session=${session}`, { cache: "no-store" });
      if (!response.ok) return;
      const nextState = await response.json() as DemoState;
      const pendingDemoRequests = nextState.requests.filter((request) => request.status === "PENDING");
      if (!initialized.current) {
        initialized.current = true;
        pendingDemoRequests.forEach((request) => {
          announcedRequests.current.add(request.id);
          void postDemoAction({ type: "resolve-request", requestId: request.id });
        });
        nextState.requests = nextState.requests.map((request) => request.status === "PENDING" ? { ...request, status: "RESOLVED" } : request);
      } else {
        const freshRequest = pendingDemoRequests.find((request) => !announcedRequests.current.has(request.id));
        if (freshRequest) {
          announcedRequests.current.add(freshRequest.id);
          setAttention(true);
          window.setTimeout(() => setAttention(false), 5000);
          speakDemoRequest(freshRequest);
        }
      }
      const nextPending = nextState.orders.filter((order) => order.status === "PENDING").length;
      if (nextPending > knownPending.current) {
        setActive("PENDING");
        setAttention(true);
        window.setTimeout(() => setAttention(false), 5000);
      }
      knownPending.current = nextPending;
      setState(nextState);
    } catch {
      // Public demo polling should fail quietly if the visitor is offline.
    }
  }

  useEffect(() => {
    loadState();
    const timer = window.setInterval(loadState, 1800);
    return () => window.clearInterval(timer);
  }, []);

  const pendingOrders = state.orders.filter((order) => order.status === "PENDING").length;
  const pendingRequests = state.requests.filter((request) => request.status === "PENDING").length;
  const paidOrders = state.orders.filter((order) => order.status === "PAID");
  const revenue = paidOrders.reduce((sum, order) => sum + order.total, 0);
  const activeOrders = useMemo(() => state.orders.filter((order) => order.status === active), [active, state.orders]);

  async function updateStatus(orderId: string, status: DemoOrderStatus) {
    const remainingInTab = state.orders.filter((order) => order.status === active && order.id !== orderId).length;
    const nextState = await postDemoAction({ type: "status", orderId, status });
    if (nextState) {
      setState(nextState);
      setActive(remainingInTab === 0 ? status : active);
      knownPending.current = nextState.orders.filter((order) => order.status === "PENDING").length;
      if (status === "PAID") {
        setCompletionMessage("");
        if (clearPaidTimer.current) window.clearTimeout(clearPaidTimer.current);
        clearPaidTimer.current = window.setTimeout(async () => {
          const clearedState = await postDemoAction({ type: "clear-paid" });
          if (clearedState) {
            setState(clearedState);
          setActive("PENDING");
          }
          setCompletionMessage("The order simulation is completed, try again for any order simultion from the main website page.");
          window.setTimeout(() => setCompletionMessage(""), 7000);
        }, 2000);
      }
    }
  }

  async function resolveRequest(requestId: string) {
    const nextState = await postDemoAction({ type: "resolve-request", requestId });
    if (nextState) setState(nextState);
  }

  return (
    <section id="demo-simulation" className="overflow-hidden rounded-lg border bg-white shadow-sm">
      <div className="bg-[#103a31] p-5 text-white md:p-7">
        <p className="w-fit rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wide">Hands-on demo simulation</p>
        <div className="mt-4 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <h2 className="text-3xl font-black leading-tight">Scan a demo table QR, place an order, and watch it arrive below.</h2>
            <p className="mt-3 text-sm leading-6 text-white/82">
              These six QR codes are real scannable demo links. When a visitor places an order from a phone, this demo dashboard keeps listening and shows it in Pending.
              Unattended pending demo orders auto-clear after 2 minutes so the simulation stays clean for the next visitor.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <DemoStep icon={ScanLine} title="1. Scan QR" body="Use phone camera or Google Lens on any table QR." />
            <DemoStep icon={Smartphone} title="2. Place order" body="Add demo food, call waiter, or ask for bill." />
            <DemoStep icon={ClipboardList} title="3. Manage live" body="Use the dashboard actions until the order is paid." />
          </div>
        </div>
      </div>

      <div className="grid gap-0">
        <div className="border-b bg-[#f8faf7] p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-primary">Demo table QR codes</p>
              <h3 className="text-2xl font-black">Scan to order</h3>
            </div>
            <div className="rounded-md bg-primary/10 p-3 text-primary">
              <QrCode className="h-6 w-6" />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-5">
            {qrCodes.map((qr) => (
              <Card key={qr.tableNumber} className="overflow-hidden">
                <CardHeader className="p-2 pb-1 sm:p-3 sm:pb-1">
                  <CardTitle className="text-center text-xs sm:text-base">Table {qr.tableNumber}</CardTitle>
                </CardHeader>
                <CardContent className="p-2 pt-0 sm:p-3 sm:pt-0">
                  <div className="rounded-md border bg-white p-2">
                    <img src={qr.dataUrl} alt={`Demo table ${qr.tableNumber} QR code`} className="mx-auto aspect-square w-full max-w-[84px] sm:max-w-[132px]" />
                  </div>
                  <a href={qr.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex h-8 w-full items-center justify-center rounded-md border bg-white px-2 text-xs font-semibold hover:bg-muted sm:h-9 sm:text-sm">
                    Open
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-4 rounded-md bg-white p-3 text-xs leading-5 text-muted-foreground shadow-sm">
            Scan a QR with another phone, or press Open to use that table link directly. Place a demo order online and the dashboard below will receive it.
          </div>
        </div>

        <div className="p-4 sm:p-5">
          {completionMessage ? (
            <div className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-primary/25 bg-white/80 p-3 text-center text-sm font-bold text-primary shadow-2xl backdrop-blur">
              {completionMessage}
            </div>
          ) : null}

          <div className={`rounded-lg border p-3 transition sm:p-4 ${attention || pendingOrders > 0 ? "border-red-300 bg-red-50 shadow-lg shadow-red-100" : "bg-white"}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-primary">Demo Dashbaord for Simulation Experience</p>
                <h3 className="text-xl font-black sm:text-2xl">Live Orders</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge label="Pending orders" value={pendingOrders} hot={pendingOrders > 0} />
                <Badge label="Requests" value={pendingRequests} hot={pendingRequests > 0} />
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
            <Stat title="Live orders" value={state.orders.filter((order) => order.status !== "PAID" && order.status !== "CANCELLED").length} />
            <Stat title="Pending" value={pendingOrders} hot={pendingOrders > 0} />
            <Stat title="Paid orders" value={paidOrders.length} />
            <Stat title="Demo revenue" value={formatCurrency(revenue)} />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4 xl:grid-cols-8">
            {demoStatuses.map((status) => {
              const count = state.orders.filter((order) => order.status === status).length;
              return (
                <button
                  key={status}
                  onClick={() => setActive(status)}
                  className={`min-h-9 rounded-md border px-2 py-1.5 text-center text-[11px] font-bold leading-tight sm:text-xs ${active === status ? "border-primary bg-primary text-white" : status === "PENDING" && count > 0 ? "border-red-300 bg-red-50 text-red-700" : "bg-white hover:bg-muted"}`}
                >
                  {demoStatusLabels[status]} <span className="ml-1 rounded bg-black/10 px-1.5 py-0.5 text-xs">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_280px]">
            <div className="space-y-3">
              {activeOrders.length === 0 ? (
                <div className="rounded-lg border border-dashed bg-white p-8 text-center text-muted-foreground">
                  No demo orders in {demoStatusLabels[active]}.
                </div>
              ) : activeOrders.map((order) => (
                <OrderCard key={order.id} order={order} onUpdate={updateStatus} />
              ))}
            </div>

            <aside className="space-y-3">
              <Card>
                <CardHeader className="p-4">
                  <CardTitle className="flex items-center gap-2 text-base"><BellRing className="h-4 w-4 text-primary" />Requests</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 p-4 pt-0">
                  {state.requests.filter((request) => request.status === "PENDING").length === 0 ? (
                    <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">No pending requests.</p>
                  ) : state.requests.filter((request) => request.status === "PENDING").map((request) => (
                    <RequestRow key={request.id} request={request} onResolve={resolveRequest} />
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="p-4"><CardTitle className="text-base">Read-only preview</CardTitle></CardHeader>
                <CardContent className="grid gap-2 p-4 pt-0 text-sm">
                  {["Menu", "QR Codes", "Reports", "Settings"].map((item) => (
                    <div key={item} className="flex items-center justify-between rounded-md border bg-muted px-3 py-2 text-muted-foreground">
                      <span>{item}</span>
                      <Lock className="h-4 w-4" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}

function speakDemoRequest(request: DemoRequest) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const text = request.type === "CALL_WAITER"
    ? `Demo call waiter from table number ${request.tableNumber}`
    : `Demo bill request from table number ${request.tableNumber}`;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

async function postDemoAction(body: Record<string, unknown>) {
  try {
    const response = await fetch("/api/demo-simulation/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session, ...body })
    });
    if (!response.ok) return null;
    return await response.json() as DemoState;
  } catch {
    return null;
  }
}

function OrderCard({ order, onUpdate }: { order: DemoOrder; onUpdate: (orderId: string, status: DemoOrderStatus) => void }) {
  const actions = demoStatusActions[order.status] || [];
  return (
    <Card className="border-l-4 border-l-primary">
      <CardContent className="p-3 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="text-base font-black sm:text-lg">Table {order.tableNumber} - {order.orderNumber}</h4>
            <p className="text-xs text-muted-foreground">{order.waiterName ? `Waiter: ${order.waiterName}` : order.customerName ? `Customer: ${order.customerName}` : order.source}</p>
          </div>
          <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-bold text-primary">{demoStatusLabels[order.status]}</span>
        </div>
        <div className="mt-3 grid gap-1.5">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-2 rounded-md bg-muted px-2 py-1.5 text-xs sm:text-sm">
              <span className="font-semibold">{item.quantity} x {item.name}</span>
              <span>{formatCurrency(item.price * item.quantity)}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
          <p className="text-lg font-black">{formatCurrency(order.total)}</p>
          <div className="grid w-full grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:w-auto sm:flex sm:flex-wrap">
            {actions.map((action) => (
              <Button
                key={action.next}
                className={`w-full shadow-sm sm:w-auto ${
                  action.tone === "danger"
                    ? ""
                    : action.tone === "success"
                      ? "border border-primary/20 bg-primary text-primary-foreground hover:brightness-95"
                      : "border border-[#103a31]/20 bg-[#103a31] text-white hover:bg-[#0c2f28]"
                }`}
                onClick={() => onUpdate(order.id, action.next)}
                variant={action.tone === "danger" ? "destructive" : "default"}
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
      <p className="flex items-center gap-2 font-bold"><Icon className="h-4 w-4 text-primary" />{label}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Table {request.tableNumber}</p>
        <Button size="sm" onClick={() => onResolve(request.id)}>Acknowledge</Button>
      </div>
    </div>
  );
}

function DemoStep({ icon: Icon, title, body }: { icon: typeof ClipboardList; title: string; body: string }) {
  return (
    <div className="flex gap-3 rounded-md border border-white/15 bg-white/10 p-3">
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-white" />
      <div>
        <p className="font-bold">{title}</p>
        <p className="mt-1 text-xs leading-5 text-white/75">{body}</p>
      </div>
    </div>
  );
}

function Stat({ title, value, hot = false }: { title: string; value: React.ReactNode; hot?: boolean }) {
  return (
    <Card className={hot ? "border-red-300 bg-red-50" : ""}>
      <CardHeader className="p-3 pb-1"><CardTitle className="text-xs text-muted-foreground">{title}</CardTitle></CardHeader>
      <CardContent className="p-3 pt-0"><p className={`text-xl font-black ${hot ? "text-red-700" : ""}`}>{value}</p></CardContent>
    </Card>
  );
}

function Badge({ label, value, hot = false }: { label: string; value: number; hot?: boolean }) {
  return (
    <div className={`rounded-md px-3 py-2 text-sm font-black ${hot ? "animate-pulse bg-red-600 text-white" : "bg-primary/10 text-primary"}`}>
      {label}: {value}
    </div>
  );
}
