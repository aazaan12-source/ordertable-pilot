"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Bell, CheckCircle2, Minus, Plus, ReceiptText, ShoppingCart, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import {
  DemoOrderItem,
  demoCategories,
  demoMenuItems,
  demoOrderNumber,
  loadDemoState,
  saveDemoState
} from "@/components/public/demo-simulation-store";

export default function DemoSimulationOrderPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#f6f7f4] p-6">Loading demo order page...</main>}>
      <DemoSimulationOrderContent />
    </Suspense>
  );
}

function DemoSimulationOrderContent() {
  const params = useSearchParams();
  const tableNumber = Math.max(1, Math.min(5, Number(params.get("table") || 1)));
  const session = params.get("session") || "public-demo";
  const [category, setCategory] = useState(demoCategories[0]);
  const [mode, setMode] = useState<"customer" | "waiter">("customer");
  const [name, setName] = useState("");
  const [cart, setCart] = useState<DemoOrderItem[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const savedWaiter = window.localStorage.getItem("ordertable_demo_waiter_name") || "";
    if (savedWaiter) setName(savedWaiter);
  }, []);

  const visibleItems = demoMenuItems.filter((item) => item.category === category);
  const total = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);
  const itemCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

  function addItem(item: (typeof demoMenuItems)[number]) {
    setCart((current) => {
      const existing = current.find((entry) => entry.id === item.id);
      if (existing) {
        return current.map((entry) => entry.id === item.id ? { ...entry, quantity: entry.quantity + 1 } : entry);
      }
      return [...current, { id: item.id, name: item.name, category: item.category, price: item.price, quantity: 1 }];
    });
  }

  function changeQuantity(id: string, delta: number) {
    setCart((current) => current
      .map((item) => item.id === id ? { ...item, quantity: item.quantity + delta } : item)
      .filter((item) => item.quantity > 0));
  }

  async function placeOrder() {
    const cleanName = name.trim();
    if (mode === "waiter" && !cleanName) {
      setMessage("Please enter waiter name before sending the demo order.");
      return;
    }
    if (cart.length === 0) {
      setMessage("Add at least one item to place a demo order.");
      return;
    }
    if (mode === "waiter") window.localStorage.setItem("ordertable_demo_waiter_name", cleanName);
    const state = loadDemoState(session);
    const serverState = await loadServerState(session);
    const orderCount = serverState?.orders.length ?? state.orders.length;
    const order = {
      id: crypto.randomUUID(),
      orderNumber: demoOrderNumber(tableNumber, orderCount),
      tableNumber,
      source: mode === "waiter" ? "Waiter Assisted" as const : "Customer QR" as const,
      customerName: mode === "customer" && cleanName ? cleanName : undefined,
      waiterName: mode === "waiter" ? cleanName : undefined,
      status: "PENDING" as const,
      paymentStatus: "UNPAID" as const,
      items: cart,
      total,
      createdAt: new Date().toISOString()
    };
    saveDemoState(session, { ...state, orders: [order, ...state.orders] });
    await postDemoAction(session, { type: "order", order });
    setCart([]);
    setMessage(`${order.orderNumber} sent to the demo dashboard.`);
  }

  async function sendRequest(type: "CALL_WAITER" | "BILL_REQUEST") {
    const state = loadDemoState(session);
    const request = {
      id: crypto.randomUUID(),
      tableNumber,
      type,
      status: "PENDING" as const,
      createdAt: new Date().toISOString()
    };
    saveDemoState(session, { ...state, requests: [request, ...state.requests] });
    await postDemoAction(session, { type: "request", request });
    setMessage(type === "CALL_WAITER" ? "Call waiter request sent to demo dashboard." : "Bill request sent to demo dashboard.");
  }

  return (
    <main className="min-h-screen bg-[#f6f7f4] pb-36">
      <div className="sticky top-0 z-20 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">Demo Restaurant</p>
            <h1 className="text-xl font-black">Table {tableNumber}</h1>
          </div>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">Demo QR Order</span>
        </div>
      </div>

      <section className="mx-auto grid max-w-5xl gap-4 px-4 py-5 lg:grid-cols-[190px_1fr]">
        <aside className="space-y-3">
          <Card>
            <CardHeader className="p-4">
              <CardTitle className="text-base">Ordering as</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-0">
              <div className="grid grid-cols-2 rounded-md border bg-muted p-1">
                <button onClick={() => setMode("customer")} className={`rounded px-2 py-2 text-sm font-bold ${mode === "customer" ? "bg-white text-primary shadow-sm" : "text-muted-foreground"}`}>Customer</button>
                <button onClick={() => setMode("waiter")} className={`rounded px-2 py-2 text-sm font-bold ${mode === "waiter" ? "bg-white text-primary shadow-sm" : "text-muted-foreground"}`}>Waiter</button>
              </div>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={mode === "waiter" ? "Waiter name required" : "Your name optional"} />
              <p className="text-xs leading-5 text-muted-foreground">
                {mode === "waiter" ? "Waiter mode marks the demo order as waiter-assisted." : "Customer mode behaves like a guest scanning the table QR."}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4">
              <CardTitle className="text-base">Categories</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 p-4 pt-0">
              {demoCategories.map((entry) => (
                <button key={entry} onClick={() => setCategory(entry)} className={`rounded-md border px-3 py-2 text-left text-sm font-bold ${category === entry ? "border-primary bg-primary text-white" : "bg-white hover:bg-muted"}`}>
                  {entry}
                </button>
              ))}
            </CardContent>
          </Card>
        </aside>

        <div className="space-y-4">
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <h2 className="text-2xl font-black">{category}</h2>
            <p className="text-sm text-muted-foreground">Add items and send them to the demo manager dashboard.</p>
          </div>

          {visibleItems.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <CardContent className="grid gap-4 p-4 sm:grid-cols-[132px_1fr]">
                <img src={item.image} alt={item.name} className="h-32 w-full rounded-md object-cover sm:w-32" />
                <div className="flex flex-col justify-between gap-4">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-black">{item.name}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                      </div>
                      <p className="shrink-0 font-black">{formatCurrency(item.price)}</p>
                    </div>
                  </div>
                  <Button onClick={() => addItem(item)} className="w-fit min-w-28"><Plus className="h-4 w-4" />Add</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {message ? (
        <div className="fixed right-3 top-20 z-30 max-w-[300px] rounded-lg border bg-white/92 p-3 text-sm shadow-lg backdrop-blur">
          <p className="flex gap-2 font-semibold"><CheckCircle2 className="h-4 w-4 text-primary" />{message}</p>
        </div>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-white/95 shadow-2xl backdrop-blur">
        <div className="mx-auto grid max-w-5xl gap-3 px-4 py-3 md:grid-cols-[1fr_1.4fr]">
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => sendRequest("CALL_WAITER")}><Bell className="h-4 w-4" />Call Waiter</Button>
            <Button variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-50" onClick={() => sendRequest("BILL_REQUEST")}><ReceiptText className="h-4 w-4" />Ask for Bill</Button>
          </div>
          <div className="rounded-lg border bg-muted p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">{itemCount} item{itemCount === 1 ? "" : "s"} selected</p>
                <p className="text-lg font-black">{formatCurrency(total)}</p>
              </div>
              <Button onClick={placeOrder} disabled={cart.length === 0} className="min-w-36"><ShoppingCart className="h-4 w-4" />Place Order</Button>
            </div>
            {cart.length ? (
              <div className="mt-3 grid gap-2">
                {cart.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-2 rounded-md bg-white px-3 py-2 text-sm">
                    <span className="font-semibold">{item.quantity} x {item.name}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => changeQuantity(item.id, -1)} className="rounded border p-1"><Minus className="h-3 w-3" /></button>
                      <button onClick={() => changeQuantity(item.id, 1)} className="rounded border p-1"><Plus className="h-3 w-3" /></button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="pointer-events-none fixed bottom-32 left-3 z-20 max-w-[260px] rounded-lg bg-[#103a31]/85 p-3 text-xs leading-5 text-white shadow-lg backdrop-blur">
        <UserRound className="mb-1 h-4 w-4" />
        Select customer or waiter, add items, then place order. Keep the demo dashboard open to see it arrive.
      </div>
    </main>
  );
}

async function loadServerState(session: string) {
  try {
    const response = await fetch(`/api/demo-simulation/state?session=${encodeURIComponent(session)}`, { cache: "no-store" });
    if (!response.ok) return null;
    return await response.json() as { orders: unknown[] };
  } catch {
    return null;
  }
}

async function postDemoAction(session: string, body: Record<string, unknown>) {
  try {
    await fetch("/api/demo-simulation/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session, ...body })
    });
  } catch {
    // Demo order page keeps local success message even if the visitor is briefly offline.
  }
}
