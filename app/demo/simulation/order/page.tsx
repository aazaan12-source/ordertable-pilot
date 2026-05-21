"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Bell, CheckCircle2, Minus, Plus, ReceiptText, ShoppingCart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MenuImage } from "@/components/ui/menu-image";
import { formatCurrency } from "@/lib/utils";
import { categoryImageFor, menuImageFor } from "@/lib/menu-images";
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
  const [specialNote, setSpecialNote] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const savedWaiter = window.localStorage.getItem("ordertable_demo_waiter_name") || "";
    if (savedWaiter) setName(savedWaiter);
  }, []);

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(""), 1000);
    return () => window.clearTimeout(timer);
  }, [message]);

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

  function removeItem(id: string) {
    setCart((current) => current.filter((item) => item.id !== id));
  }

  function clearCart() {
    setCart([]);
    setSpecialNote("");
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
    setSpecialNote("");
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
    <main className="min-h-screen bg-[#f6f7f4] pb-44 sm:pb-28">
      <div className="sticky top-0 z-20 border-b bg-background/95 px-3 py-2 backdrop-blur sm:px-4 sm:py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">OrderTable Demo</p>
            <h1 className="truncate text-base font-bold sm:text-xl">Demo Restaurant</h1>
            <p className="truncate text-xs text-muted-foreground sm:text-sm">Sample Branch, Islamabad</p>
          </div>
          <div className="shrink-0 rounded-md bg-primary px-2 py-2 text-xs font-semibold text-primary-foreground sm:px-3 sm:text-sm">Table {tableNumber}</div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-2 py-3 sm:px-4 sm:py-5">
        <section className="mb-4">
          <Card>
            <CardContent className="p-3 sm:p-4">
              <p className="text-sm font-semibold">Who is placing this order?</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button onClick={() => setMode("customer")} className={`rounded-md border px-3 py-2 text-sm font-semibold ${mode === "customer" ? "border-primary bg-primary text-primary-foreground" : "bg-white"}`}>Customer ordering</button>
                <button onClick={() => setMode("waiter")} className={`rounded-md border px-3 py-2 text-sm font-semibold ${mode === "waiter" ? "border-primary bg-primary text-primary-foreground" : "bg-white"}`}>Waiter taking order</button>
              </div>
              <div className="mt-3">
                <Input value={name} onChange={(event) => setName(event.target.value.slice(0, 80))} placeholder={mode === "waiter" ? "Waiter name required" : "Your name optional"} />
              </div>
            </CardContent>
          </Card>
        </section>

        <div className="grid grid-cols-[74px_minmax(0,1fr)] gap-2 sm:grid-cols-[112px_minmax(0,1fr)] sm:gap-3 lg:grid-cols-[190px_1fr] lg:gap-5">
          <aside className="sticky top-[65px] z-10 self-start sm:top-20 lg:top-24">
            <div className="max-h-[calc(100vh-150px)] overflow-y-auto rounded-md border bg-white p-1 sm:rounded-lg sm:p-3">
              <p className="mb-1.5 text-center text-[9px] font-bold uppercase tracking-wide text-muted-foreground sm:mb-2 sm:px-2 sm:text-left sm:text-xs">Categories</p>
              <div className="space-y-1 sm:space-y-2">
                {demoCategories.map((entry) => (
                  <button key={entry} onClick={() => setCategory(entry)} className={`w-full rounded-md px-1 py-1.5 text-center text-[10px] font-semibold leading-tight transition sm:px-3 sm:py-2 sm:text-left sm:text-sm ${category === entry ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-border"}`}>
                    <span className="flex min-w-0 flex-col items-center gap-1 sm:flex-row sm:gap-2">
                      <MenuImage src={categoryImageFor(entry)} variant="categoryIcon" />
                      <span className="line-clamp-2 break-words">{entry}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <div className="grid min-w-0 gap-2 sm:gap-3 md:grid-cols-2 lg:gap-4">
            {visibleItems.map((item) => {
              const cartItem = cart.find((entry) => entry.id === item.id);
              return (
                <Card key={item.id} className="grid min-w-0 grid-cols-[78px_minmax(0,1fr)] overflow-hidden sm:grid-cols-[104px_minmax(0,1fr)] md:block">
                  <MenuImage src={menuImageFor(item.name, item.category, item.image)} alt={item.name} variant="customerCard" className="border-0" />
                  <CardContent className="min-w-0 p-2 sm:p-3 lg:p-4">
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="line-clamp-2 text-sm font-semibold leading-tight sm:text-base">{item.name}</h2>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground sm:text-sm">{item.description}</p>
                      </div>
                      <p className="shrink-0 text-xs font-bold sm:text-sm lg:text-base">{formatCurrency(item.price)}</p>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 sm:mt-3">
                      {cartItem ? (
                        <div className="flex items-center gap-1 sm:gap-2">
                          <Button size="icon" variant="outline" onClick={() => changeQuantity(item.id, -1)}><Minus className="h-4 w-4" /></Button>
                          <span className="w-6 text-center text-sm font-semibold sm:w-8">{cartItem.quantity}</span>
                          <Button size="icon" variant="outline" onClick={() => changeQuantity(item.id, 1)}><Plus className="h-4 w-4" /></Button>
                        </div>
                      ) : <span className="text-[11px] text-muted-foreground sm:text-sm">Freshly prepared</span>}
                      <Button size="sm" onClick={() => addItem(item)}>Add</Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {cart.length > 0 ? (
          <section className="mt-6 rounded-lg border bg-white p-4">
            <h2 className="mb-3 text-lg font-semibold">Your cart</h2>
            <div className="space-y-3">
              {cart.map((item) => (
                <div key={item.id} className="border-b pb-3 last:border-0">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{item.quantity} x {item.name}</p>
                    <p className="font-semibold">{formatCurrency(item.price * item.quantity)}</p>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Button size="icon" variant="outline" onClick={() => changeQuantity(item.id, -1)}><Minus className="h-4 w-4" /></Button>
                    <span className="w-8 text-center font-semibold">{item.quantity}</span>
                    <Button size="icon" variant="outline" onClick={() => changeQuantity(item.id, 1)}><Plus className="h-4 w-4" /></Button>
                    <Button size="icon" variant="destructive" onClick={() => removeItem(item.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
            <Textarea className="mt-4" placeholder="Overall order note" value={specialNote} onChange={(event) => setSpecialNote(event.target.value)} />
            <div className="mt-4 space-y-2 rounded-md bg-muted p-3 text-sm">
              <BillRow label="Subtotal" value={total} />
              <div className="border-t pt-2">
                <BillRow label="Estimated Total" value={total} strong />
              </div>
            </div>
            <Button type="button" variant="outline" className="mt-3 w-full" onClick={clearCart}>Clear cart</Button>
          </section>
        ) : null}
      </main>

      {message ? (
        <div className="fixed right-3 top-20 z-30 max-w-[300px] rounded-lg border bg-white/92 p-3 text-sm shadow-lg backdrop-blur">
          <p className="flex gap-2 font-semibold"><CheckCircle2 className="h-4 w-4 text-primary" />{message}</p>
        </div>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-white p-3 shadow-lg sm:p-4">
        <div className="mx-auto max-w-5xl space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => sendRequest("CALL_WAITER")}><Bell className="h-4 w-4" />Call Waiter</Button>
            <Button variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-50" onClick={() => sendRequest("BILL_REQUEST")}><ReceiptText className="h-4 w-4" />Ask for Bill</Button>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">{itemCount} items</p>
              <p className="text-lg font-bold">{formatCurrency(total)}</p>
              <p className="text-xs text-muted-foreground">Estimated total</p>
            </div>
            <Button size="lg" onClick={placeOrder} disabled={cart.length === 0}>
              <ShoppingCart className="h-5 w-5" />
              {mode === "waiter" ? "Send Order to Counter" : cart.length > 0 ? "View Cart & Place Order" : "Place Order"}
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}

function BillRow({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={strong ? "flex justify-between gap-3 text-base font-bold" : "flex justify-between gap-3"}>
      <span>{label}</span>
      <span>{formatCurrency(value)}</span>
    </div>
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
