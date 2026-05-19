"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { MenuImage } from "@/components/ui/menu-image";
import { formatCurrency } from "@/lib/utils";
import { categoryImageFor, menuImageFor } from "@/lib/menu-images";

type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: string;
  imageUrl: string | null;
  category: { id: string; name: string };
};

type CartItem = {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  specialInstruction: string;
};

type ActiveOrderSummary = {
  id: string;
  orderNumber: string;
  status: string;
  statusLabel: string;
  sourceLabel: string;
  customerName: string | null;
  waiterName: string | null;
  total: string;
  items: { id: string; itemName: string; quantity: number; totalPrice: string; specialInstruction: string | null }[];
};

export function OrderMenu({
  restaurant,
  tableNumber,
  categories,
  waiterOptions = [],
  items,
  activeOrder,
  editOrder
}: {
  restaurant: {
    name: string;
    slug: string;
    logoUrl: string | null;
    branchName?: string;
    city?: string;
    serviceChargePercent?: string;
    taxPercent?: string;
  };
  tableNumber: number;
  categories: { id: string; name: string; imageUrl?: string | null }[];
  waiterOptions?: { id: string; name: string }[];
  items: MenuItem[];
  activeOrder?: ActiveOrderSummary | null;
  editOrder?: {
    id: string;
    orderNumber: string;
    specialNote: string | null;
    items: { menuItemId: string; itemName: string; unitPrice: string; quantity: number; specialInstruction: string | null }[];
  };
}) {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id || "");
  const [cart, setCart] = useState<CartItem[]>(
    editOrder?.items.map((item) => ({
      menuItemId: item.menuItemId,
      name: item.itemName,
      price: Number(item.unitPrice),
      quantity: item.quantity,
      specialInstruction: item.specialInstruction || ""
    })) || []
  );
  const [specialNote, setSpecialNote] = useState(editOrder?.specialNote || "");
  const [placedByType, setPlacedByType] = useState<"CUSTOMER" | "WAITER">("CUSTOMER");
  const [customerName, setCustomerName] = useState(editOrder?.items ? "" : "");
  const [waiterName, setWaiterName] = useState("");
  const [waiterEntryMode, setWaiterEntryMode] = useState<"LIST" | "MANUAL">("LIST");
  const [selectedWaiterName, setSelectedWaiterName] = useState("");
  const [addToActiveOrder, setAddToActiveOrder] = useState(Boolean(activeOrder && !editOrder));
  const [error, setError] = useState("");
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    const savedWaiterName = localStorage.getItem("ordertable_waiter_name") || "";
    if (savedWaiterName) {
      const inList = waiterOptions.some((waiter) => waiter.name === savedWaiterName);
      if (inList) {
        setWaiterEntryMode("LIST");
        setSelectedWaiterName(savedWaiterName);
      } else {
        setWaiterEntryMode("MANUAL");
        setWaiterName(savedWaiterName);
      }
    } else if (waiterOptions[0]?.name) {
      setSelectedWaiterName(waiterOptions[0].name);
    } else {
      setWaiterEntryMode("MANUAL");
    }
  }, [waiterOptions]);

  const visibleItems = activeCategory ? items.filter((item) => item.category.id === activeCategory) : items;
  const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const serviceChargePercent = Number(restaurant.serviceChargePercent || 0);
  const taxPercent = Number(restaurant.taxPercent || 0);
  const serviceCharges = Math.round((subtotal * serviceChargePercent) / 100);
  const tax = Math.round(((subtotal + serviceCharges) * taxPercent) / 100);
  const discount = 0;
  const estimatedTotal = subtotal + serviceCharges + tax - discount;

  const cartById = useMemo(() => new Map(cart.map((item) => [item.menuItemId, item])), [cart]);

  function addItem(item: MenuItem) {
    const price = Number(item.price);
    setCart((current) => {
      const existing = current.find((entry) => entry.menuItemId === item.id);
      if (existing) {
        return current.map((entry) =>
          entry.menuItemId === item.id ? { ...entry, quantity: Math.min(20, entry.quantity + 1) } : entry
        );
      }
      return [...current, { menuItemId: item.id, name: item.name, price, quantity: 1, specialInstruction: "" }];
    });
  }

  function changeQty(menuItemId: string, delta: number) {
    setCart((current) =>
      current
        .map((item) => (item.menuItemId === menuItemId ? { ...item, quantity: item.quantity + delta } : item))
        .filter((item) => item.quantity > 0)
        .map((item) => ({ ...item, quantity: Math.min(20, item.quantity) }))
    );
  }

  function changeInstruction(menuItemId: string, value: string) {
    setCart((current) =>
      current.map((item) => (item.menuItemId === menuItemId ? { ...item, specialInstruction: value } : item))
    );
  }

  function removeItem(menuItemId: string) {
    setCart((current) => current.filter((item) => item.menuItemId !== menuItemId));
  }

  function clearCart() {
    setCart([]);
    setSpecialNote("");
  }

  async function placeOrder() {
    if (cart.length === 0) return;
    const effectiveWaiterName = waiterEntryMode === "LIST" ? selectedWaiterName.trim() : waiterName.trim();
    if (!editOrder && placedByType === "WAITER" && !effectiveWaiterName) {
      setError("Please enter waiter name before sending the order.");
      return;
    }
    if (!editOrder && placedByType === "WAITER") {
      localStorage.setItem("ordertable_waiter_name", effectiveWaiterName);
    }
    setPlacing(true);
    setError("");
    try {
      const response = await fetch(editOrder ? `/api/customer/orders/${editOrder.id}` : "/api/customer/orders", {
        method: editOrder ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantSlug: restaurant.slug,
          tableNumber,
          placedByType,
          customerName: customerName.trim() || null,
          waiterName: placedByType === "WAITER" ? effectiveWaiterName : null,
          activeOrderId: addToActiveOrder && activeOrder ? activeOrder.id : null,
          specialNote,
          items: cart.map(({ menuItemId, quantity, specialInstruction }) => ({ menuItemId, quantity, specialInstruction }))
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error || "Something went wrong placing your order.");
        return;
      }
      localStorage.setItem(`ordertable:${restaurant.slug}:${tableNumber}:lastOrder`, payload.orderId);
      router.push(editOrder ? `/order/${payload.orderId}/status` : `/order/${payload.orderId}/success`);
    } catch {
      setError("Connection issue. Please try again.");
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="min-h-screen pb-44 sm:pb-28">
      <header className="sticky top-0 z-20 border-b bg-background/95 px-3 py-2 backdrop-blur sm:px-4 sm:py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">OrderTable</p>
            <h1 className="truncate text-base font-bold sm:text-xl">{editOrder ? `Edit ${editOrder.orderNumber}` : restaurant.name}</h1>
            <p className="truncate text-xs text-muted-foreground sm:text-sm">{[restaurant.branchName, restaurant.city].filter(Boolean).join(", ")}</p>
          </div>
          <div className="shrink-0 rounded-md bg-primary px-2 py-2 text-xs font-semibold text-primary-foreground sm:px-3 sm:text-sm">Table {tableNumber}</div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-2 py-3 sm:px-4 sm:py-5">
        {editOrder ? (
          <Link href={`/order/${editOrder.id}/status`} className="mb-4 block rounded-md border bg-white p-3 text-sm font-semibold text-primary">
            Back to order status
          </Link>
        ) : null}

        {!editOrder ? (
          <section className="mb-4 grid gap-3 lg:grid-cols-[1fr_1fr]">
            <Card>
              <CardContent className="p-3 sm:p-4">
                <p className="text-sm font-semibold">Who is placing this order?</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPlacedByType("CUSTOMER")}
                    className={`rounded-md border px-3 py-2 text-sm font-semibold ${placedByType === "CUSTOMER" ? "border-primary bg-primary text-primary-foreground" : "bg-white"}`}
                  >
                    Customer ordering
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlacedByType("WAITER")}
                    className={`rounded-md border px-3 py-2 text-sm font-semibold ${placedByType === "WAITER" ? "border-primary bg-primary text-primary-foreground" : "bg-white"}`}
                  >
                    Waiter taking order
                  </button>
                </div>
                <div className="mt-3">
                  {placedByType === "CUSTOMER" ? (
                    <input
                      className="h-10 w-full rounded-md border px-3 text-sm"
                      value={customerName}
                      onChange={(event) => setCustomerName(event.target.value.slice(0, 80))}
                      placeholder="Your name optional"
                    />
                  ) : (
                    <div className="space-y-2">
                      {waiterOptions.length > 0 ? (
                        <div className="grid gap-2">
                          <select
                            className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                            value={waiterEntryMode === "LIST" ? selectedWaiterName : "__manual"}
                            onChange={(event) => {
                              if (event.target.value === "__manual") {
                                setWaiterEntryMode("MANUAL");
                                return;
                              }
                              setWaiterEntryMode("LIST");
                              setSelectedWaiterName(event.target.value);
                              setWaiterName("");
                            }}
                          >
                            {waiterOptions.map((waiter) => (
                              <option key={waiter.id} value={waiter.name}>{waiter.name}</option>
                            ))}
                            <option value="__manual">Manual entry / name not in list</option>
                          </select>
                          {waiterEntryMode === "MANUAL" ? (
                            <input
                              className="h-10 w-full rounded-md border px-3 text-sm"
                              value={waiterName}
                              onChange={(event) => setWaiterName(event.target.value.slice(0, 80))}
                              placeholder="Enter waiter name manually"
                              required
                            />
                          ) : null}
                        </div>
                      ) : (
                        <input
                          className="h-10 w-full rounded-md border px-3 text-sm"
                          value={waiterName}
                          onChange={(event) => setWaiterName(event.target.value.slice(0, 80))}
                          placeholder="Enter waiter name"
                          required
                        />
                      )}
                      <p className="text-xs text-muted-foreground">Use this when a waiter is taking the order on behalf of customers.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {activeOrder ? (
              <Card>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Current order for this table</p>
                      <p className="text-xs text-muted-foreground">
                        {activeOrder.orderNumber} - {activeOrder.statusLabel} - {activeOrder.sourceLabel}
                      </p>
                      {activeOrder.waiterName ? <p className="mt-1 text-sm font-medium">Placed by Waiter {activeOrder.waiterName}</p> : null}
                      {!activeOrder.waiterName && activeOrder.customerName ? <p className="mt-1 text-sm font-medium">Customer: {activeOrder.customerName}</p> : null}
                    </div>
                    <Link href={`/order/${activeOrder.id}/status`} className="shrink-0 rounded-md border px-3 py-2 text-xs font-semibold hover:bg-muted">
                      View status
                    </Link>
                  </div>
                  <div className="mt-3 max-h-28 space-y-1 overflow-y-auto rounded-md bg-muted p-2 text-xs">
                    {activeOrder.items.map((item) => (
                      <p key={item.id} className="flex justify-between gap-2">
                        <span>{item.quantity} x {item.itemName}</span>
                        <span>{formatCurrency(item.totalPrice)}</span>
                      </p>
                    ))}
                  </div>
                  <p className="mt-2 text-sm font-bold">Total: {formatCurrency(activeOrder.total)}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <button
                      type="button"
                      onClick={() => setAddToActiveOrder(true)}
                      className={`rounded-md border px-3 py-2 font-semibold ${addToActiveOrder ? "border-primary bg-primary text-primary-foreground" : "bg-white"}`}
                    >
                      Add to current
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddToActiveOrder(false)}
                      className={`rounded-md border px-3 py-2 font-semibold ${!addToActiveOrder ? "border-primary bg-primary text-primary-foreground" : "bg-white"}`}
                    >
                      Separate order
                    </button>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </section>
        ) : null}

        <div className="grid grid-cols-[74px_minmax(0,1fr)] gap-2 sm:grid-cols-[112px_minmax(0,1fr)] sm:gap-3 lg:grid-cols-[190px_1fr] lg:gap-5">
          <aside className="sticky top-[65px] z-10 self-start sm:top-20 lg:top-24">
            <div className="max-h-[calc(100vh-150px)] overflow-y-auto rounded-md border bg-white p-1 sm:rounded-lg sm:p-3">
              <p className="mb-1.5 text-center text-[9px] font-bold uppercase tracking-wide text-muted-foreground sm:mb-2 sm:px-2 sm:text-left sm:text-xs">Categories</p>
              <div className="space-y-1 sm:space-y-2">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setActiveCategory(category.id)}
                    className={`w-full rounded-md px-1 py-1.5 text-center text-[10px] font-semibold leading-tight transition sm:px-3 sm:py-2 sm:text-left sm:text-sm ${
                      activeCategory === category.id ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-border"
                    }`}
                  >
                    <span className="flex min-w-0 flex-col items-center gap-1 sm:flex-row sm:gap-2">
                      <MenuImage src={categoryImageFor(category.name, category.imageUrl)} variant="categoryIcon" />
                      <span className="line-clamp-2 break-words">{category.name}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <div className="grid min-w-0 gap-2 sm:gap-3 md:grid-cols-2 lg:gap-4">
            {visibleItems.map((item) => {
              const cartItem = cartById.get(item.id);
              return (
                <Card key={item.id} className="grid min-w-0 grid-cols-[78px_minmax(0,1fr)] overflow-hidden sm:grid-cols-[104px_minmax(0,1fr)] md:block">
                  <MenuImage
                    src={menuImageFor(item.name, item.category.name, item.imageUrl)}
                    alt={item.name}
                    variant="customerCard"
                    className="border-0"
                  />
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
                          <Button size="icon" variant="outline" onClick={() => changeQty(item.id, -1)}><Minus className="h-4 w-4" /></Button>
                          <span className="w-6 text-center text-sm font-semibold sm:w-8">{cartItem.quantity}</span>
                          <Button size="icon" variant="outline" onClick={() => changeQty(item.id, 1)}><Plus className="h-4 w-4" /></Button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground sm:text-sm">Freshly prepared</span>
                      )}
                      <Button size="sm" onClick={() => addItem(item)}>{cartItem ? "Add" : "Add"}</Button>
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
            <div className="space-y-4">
              {cart.map((item) => (
                <div key={item.menuItemId} className="border-b pb-3 last:border-0">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{item.quantity} x {item.name}</p>
                    <p className="font-semibold">{formatCurrency(item.price * item.quantity)}</p>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Button size="icon" variant="outline" onClick={() => changeQty(item.menuItemId, -1)} aria-label={`Decrease ${item.name}`}>
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-8 text-center font-semibold">{item.quantity}</span>
                    <Button size="icon" variant="outline" onClick={() => changeQty(item.menuItemId, 1)} aria-label={`Increase ${item.name}`}>
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="destructive" onClick={() => removeItem(item.menuItemId)} aria-label={`Remove ${item.name}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Textarea
                    className="mt-2 min-h-16"
                    placeholder="Special instruction for this item"
                    value={item.specialInstruction}
                    onChange={(event) => changeInstruction(item.menuItemId, event.target.value)}
                  />
                </div>
              ))}
            </div>
            <Textarea className="mt-4" placeholder="Overall order note" value={specialNote} onChange={(e) => setSpecialNote(e.target.value)} />
            <div className="mt-4 space-y-2 rounded-md bg-muted p-3 text-sm">
              <BillRow label="Subtotal" value={subtotal} />
              <BillRow label="Service Charges" value={serviceCharges} detail={serviceChargePercent ? `${serviceChargePercent}%` : undefined} />
              <BillRow label="Tax" value={tax} detail={taxPercent ? `${taxPercent}%` : undefined} />
              <BillRow label="Discount" value={discount} />
              <div className="border-t pt-2">
                <BillRow label="Estimated Total" value={estimatedTotal} strong />
              </div>
            </div>
            <Button type="button" variant="outline" className="mt-3 w-full" onClick={clearCart}>
              Clear cart
            </Button>
            {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
          </section>
        ) : null}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-white p-4 shadow-lg">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{totalQty} items</p>
            <p className="text-lg font-bold">{formatCurrency(estimatedTotal)}</p>
            <p className="text-xs text-muted-foreground">Estimated total</p>
          </div>
          <Button size="lg" disabled={cart.length === 0 || placing} onClick={placeOrder}>
            <ShoppingCart className="h-5 w-5" />
            {placing ? "Sending..." : editOrder ? "Save changes" : placedByType === "WAITER" ? "Send Order to Counter" : addToActiveOrder && activeOrder ? "Add Items to Order" : "Place Order"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function BillRow({ label, value, detail, strong }: { label: string; value: number; detail?: string; strong?: boolean }) {
  return (
    <div className={strong ? "flex justify-between gap-3 text-base font-bold" : "flex justify-between gap-3"}>
      <span>{detail ? `${label} (${detail})` : label}</span>
      <span>{formatCurrency(value)}</span>
    </div>
  );
}
