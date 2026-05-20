"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
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
  const [identityOpen, setIdentityOpen] = useState(true);
  const [error, setError] = useState("");
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    const savedWaiterName = localStorage.getItem("ordertable_waiter_name") || "";
    if (savedWaiterName) setWaiterName(savedWaiterName);
  }, []);

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
  const activeCategoryName = categories.find((category) => category.id === activeCategory)?.name || "Menu";
  const identityLabel = placedByType === "WAITER" ? "Waiter taking order" : "Customer ordering";
  const identityName = placedByType === "WAITER" ? waiterName.trim() : customerName.trim();

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
    const effectiveWaiterName = waiterName.trim();
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
    <div className="min-h-screen bg-[linear-gradient(180deg,#fffaf3_0%,hsl(var(--background))_38%,#f7faf8_100%)] pb-52 sm:pb-28">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-white/95 px-3 py-2.5 shadow-sm backdrop-blur sm:px-4 sm:py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {restaurant.logoUrl ? (
              <img src={restaurant.logoUrl} alt="" className="h-10 w-10 shrink-0 rounded-xl border bg-white object-cover p-1 shadow-sm" />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-black text-primary shadow-sm">
                {restaurant.name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary/80">OrderTable</p>
              <h1 className="truncate text-base font-black leading-tight text-foreground sm:text-xl">{editOrder ? `Edit ${editOrder.orderNumber}` : restaurant.name}</h1>
              <p className="truncate text-xs text-muted-foreground sm:text-sm">{[restaurant.branchName, restaurant.city].filter(Boolean).join(", ")}</p>
            </div>
          </div>
          <div className="shrink-0 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1.5 text-xs font-black text-primary shadow-sm sm:px-3 sm:text-sm">Table {tableNumber}</div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-3 py-3 sm:px-4 sm:py-5">
        {editOrder ? (
          <Link href={`/order/${editOrder.id}/status`} className="mb-4 block rounded-xl border bg-white p-3 text-sm font-semibold text-primary shadow-sm">
            Back to order status
          </Link>
        ) : null}

        {!editOrder ? (
          <section className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
            <Card className="overflow-hidden rounded-2xl border-border/70 bg-white/95 shadow-[0_12px_35px_rgba(15,23,42,0.07)]">
              <CardContent className="p-3 sm:p-4">
                {identityOpen ? (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-foreground">Who is placing this order?</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">Choose once, then continue ordering.</p>
                      </div>
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">Table {tableNumber}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPlacedByType("CUSTOMER")}
                        className={`min-h-12 rounded-xl border px-3 py-2 text-sm font-bold transition active:scale-[0.98] ${
                          placedByType === "CUSTOMER" ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border bg-white hover:bg-muted"
                        }`}
                      >
                        Customer ordering
                      </button>
                      <button
                        type="button"
                        onClick={() => setPlacedByType("WAITER")}
                        className={`min-h-12 rounded-xl border px-3 py-2 text-sm font-bold transition active:scale-[0.98] ${
                          placedByType === "WAITER" ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border bg-white hover:bg-muted"
                        }`}
                      >
                        Waiter taking order
                      </button>
                    </div>
                    <div className="mt-3">
                      {placedByType === "CUSTOMER" ? (
                        <input
                          className="h-11 w-full rounded-xl border bg-white px-3 text-sm shadow-inner outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                          value={customerName}
                          onChange={(event) => setCustomerName(event.target.value.slice(0, 80))}
                          placeholder="Your name optional"
                        />
                      ) : (
                        <div className="space-y-2">
                          <WaiterNameCombobox
                            value={waiterName}
                            onChange={setWaiterName}
                            options={waiterOptions.map((waiter) => waiter.name)}
                            placeholder={waiterOptions.length > 0 ? "Select or type waiter name" : "Enter waiter name"}
                          />
                          <p className="text-xs text-muted-foreground">Use this when staff takes the order for guests.</p>
                        </div>
                      )}
                    </div>
                    <Button
                      type="button"
                      className="mt-3 w-full rounded-xl"
                      onClick={() => setIdentityOpen(false)}
                      disabled={placedByType === "WAITER" && !waiterName.trim()}
                    >
                      Continue
                    </Button>
                  </>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Ordering as</p>
                      <p className="truncate text-sm font-black text-foreground">
                        {identityLabel}{identityName ? ` - ${identityName}` : ""}
                      </p>
                    </div>
                    <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => setIdentityOpen(true)}>
                      Change
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {activeOrder ? (
              <Card className="overflow-hidden rounded-2xl border-primary/15 bg-white/95 shadow-[0_12px_35px_rgba(15,23,42,0.07)]">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-black">Current order for this table</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {activeOrder.orderNumber} - {activeOrder.statusLabel} - {activeOrder.sourceLabel}
                      </p>
                      {activeOrder.waiterName ? <p className="mt-1 text-sm font-semibold">Placed by Waiter {activeOrder.waiterName}</p> : null}
                      {!activeOrder.waiterName && activeOrder.customerName ? <p className="mt-1 text-sm font-semibold">Customer: {activeOrder.customerName}</p> : null}
                    </div>
                    <Link href={`/order/${activeOrder.id}/status`} className="shrink-0 rounded-full border px-3 py-2 text-xs font-bold text-primary shadow-sm hover:bg-primary/5">
                      Status
                    </Link>
                  </div>
                  <div className="mt-3 max-h-28 space-y-1 overflow-y-auto rounded-xl bg-muted/70 p-2 text-xs">
                    {activeOrder.items.map((item) => (
                      <p key={item.id} className="flex justify-between gap-2">
                        <span className="line-clamp-1">{item.quantity} x {item.itemName}</span>
                        <span className="shrink-0">{formatCurrency(item.totalPrice)}</span>
                      </p>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between rounded-xl border bg-white px-3 py-2">
                    <span className="text-xs font-semibold text-muted-foreground">Running total</span>
                    <span className="text-sm font-black">{formatCurrency(activeOrder.total)}</span>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </section>
        ) : null}

        <div className="grid gap-3 lg:grid-cols-[220px_1fr] lg:gap-5">
          <aside className="sticky top-[61px] z-20 self-start sm:top-[70px] lg:top-24">
            <div className="rounded-2xl border border-border/70 bg-white/95 p-2 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur lg:p-3">
              <div className="mb-2 flex items-center justify-between gap-3 px-1 lg:px-0">
                <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Categories</p>
                <p className="hidden text-xs font-semibold text-primary lg:block">{activeCategoryName}</p>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 lg:max-h-[calc(100vh-170px)] lg:flex-col lg:overflow-y-auto lg:overflow-x-visible lg:pb-0">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setActiveCategory(category.id)}
                    className={`flex min-w-[92px] shrink-0 flex-col items-center gap-1.5 rounded-xl border px-2 py-2 text-center text-xs font-bold leading-tight transition active:scale-[0.98] lg:min-w-0 lg:flex-row lg:justify-start lg:text-left lg:text-sm ${
                      activeCategory === category.id
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-transparent bg-muted/70 text-foreground hover:bg-border/70"
                    }`}
                  >
                    <MenuImage
                      src={categoryImageFor(category.name, category.imageUrl)}
                      variant="categoryIcon"
                      className="border-white/60"
                      imageClassName="object-cover p-0"
                    />
                    <span className="line-clamp-2 break-words">{category.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <div className="min-w-0">
            <div className="mb-3 flex items-end justify-between gap-3 px-1">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-primary/80">Menu</p>
                <h2 className="truncate text-xl font-black text-foreground">{activeCategoryName}</h2>
              </div>
              <p className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-bold text-muted-foreground shadow-sm">{visibleItems.length} items</p>
            </div>

            {visibleItems.length === 0 ? (
              <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
                <p className="text-base font-black">No items in this category yet.</p>
                <p className="mt-1 text-sm text-muted-foreground">Please choose another category or call restaurant staff.</p>
              </div>
            ) : null}

            <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:gap-4">
              {visibleItems.map((item) => {
                const cartItem = cartById.get(item.id);
                return (
                  <Card key={item.id} className="grid min-w-0 grid-cols-[104px_minmax(0,1fr)] overflow-hidden rounded-2xl border-border/70 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_35px_rgba(15,23,42,0.09)] sm:grid-cols-[120px_minmax(0,1fr)] md:block">
                    <MenuImage
                      src={menuImageFor(item.name, item.category.name, item.imageUrl)}
                      alt={item.name}
                      variant="customerCard"
                      className="h-full min-h-[132px] rounded-none border-0 bg-muted md:h-40 md:min-h-0"
                      imageClassName="object-cover p-0"
                    />
                    <CardContent className="flex min-w-0 flex-col p-3 sm:p-4">
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-start justify-between gap-2">
                          <h2 className="line-clamp-2 text-sm font-black leading-tight text-foreground sm:text-base">{item.name}</h2>
                          <p className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-xs font-black text-primary sm:text-sm">{formatCurrency(item.price)}</p>
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">{item.description}</p>
                      </div>
                      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
                        {cartItem ? (
                          <div className="flex items-center gap-1 rounded-full border bg-white p-1 shadow-sm">
                            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => changeQty(item.id, -1)}><Minus className="h-4 w-4" /></Button>
                            <span className="w-6 text-center text-sm font-black">{cartItem.quantity}</span>
                            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => changeQty(item.id, 1)}><Plus className="h-4 w-4" /></Button>
                          </div>
                        ) : (
                          <span className="text-[11px] font-semibold text-muted-foreground sm:text-xs">Freshly prepared</span>
                        )}
                        <Button size="sm" className="min-h-9 rounded-full px-4 font-black shadow-sm" onClick={() => addItem(item)}>
                          {cartItem ? "Add more" : "Add"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>

        {cart.length > 0 ? (
          <section className="mt-6 rounded-2xl border border-border/70 bg-white p-4 shadow-[0_14px_35px_rgba(15,23,42,0.07)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-black">Your cart</h2>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-black text-primary">{totalQty} item{totalQty === 1 ? "" : "s"}</span>
            </div>
            <div className="space-y-4">
              {cart.map((item) => (
                <div key={item.menuItemId} className="rounded-2xl border bg-muted/30 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-bold">{item.quantity} x {item.name}</p>
                    <p className="font-black">{formatCurrency(item.price * item.quantity)}</p>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Button size="icon" variant="outline" className="rounded-full" onClick={() => changeQty(item.menuItemId, -1)} aria-label={`Decrease ${item.name}`}>
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-8 text-center font-black">{item.quantity}</span>
                    <Button size="icon" variant="outline" className="rounded-full" onClick={() => changeQty(item.menuItemId, 1)} aria-label={`Increase ${item.name}`}>
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="destructive" className="ml-auto rounded-full" onClick={() => removeItem(item.menuItemId)} aria-label={`Remove ${item.name}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Textarea
                    className="mt-3 min-h-16 rounded-xl bg-white"
                    placeholder="Special instruction for this item"
                    value={item.specialInstruction}
                    onChange={(event) => changeInstruction(item.menuItemId, event.target.value)}
                  />
                </div>
              ))}
            </div>
            <Textarea className="mt-4 rounded-xl bg-white" placeholder="Overall order note" value={specialNote} onChange={(e) => setSpecialNote(e.target.value)} />
            <div className="mt-4 space-y-2 rounded-2xl bg-muted/70 p-3 text-sm">
              <BillRow label="Subtotal" value={subtotal} />
              <BillRow label="Service Charges" value={serviceCharges} detail={serviceChargePercent ? `${serviceChargePercent}%` : undefined} />
              <BillRow label="Tax" value={tax} detail={taxPercent ? `${taxPercent}%` : undefined} />
              <BillRow label="Discount" value={discount} />
              <div className="border-t pt-2">
                <BillRow label="Estimated Total" value={estimatedTotal} strong />
              </div>
            </div>
            <Button type="button" variant="outline" className="mt-3 w-full rounded-xl" onClick={clearCart}>
              Clear cart
            </Button>
            {error ? <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-destructive">{error}</p> : null}
          </section>
        ) : null}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-white/95 p-3 shadow-[0_-16px_40px_rgba(15,23,42,0.12)] backdrop-blur sm:p-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{totalQty} item{totalQty === 1 ? "" : "s"}</p>
            <p className="truncate text-xl font-black text-foreground">{formatCurrency(estimatedTotal)}</p>
            <p className="text-xs text-muted-foreground">Estimated total</p>
          </div>
          <Button
            size="lg"
            disabled={cart.length === 0 || placing}
            onClick={placeOrder}
            className={`min-h-12 shrink-0 rounded-2xl px-4 font-black shadow-sm sm:px-5 ${cart.length > 0 ? "bg-primary text-primary-foreground" : ""}`}
          >
            <ShoppingCart className="h-5 w-5" />
            <span className="hidden sm:inline">{placing ? "Sending..." : editOrder ? "Save changes" : cart.length > 0 ? "View Cart & Place Order" : "Place Order"}</span>
            <span className="max-w-[138px] text-sm leading-tight sm:hidden">{placing ? "Sending..." : editOrder ? "Save" : cart.length > 0 ? "View Cart & Place Order" : "Place Order"}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

function WaiterNameCombobox({
  value,
  onChange,
  options,
  placeholder
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const uniqueOptions = useMemo(() => Array.from(new Set(options.filter(Boolean))), [options]);

  return (
    <div className="relative">
      <input
        className="h-11 w-full rounded-xl border bg-white px-3 pr-10 text-sm shadow-inner outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
        value={value}
        onChange={(event) => {
          onChange(event.target.value.slice(0, 80));
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 140)}
        placeholder={placeholder}
        autoComplete="off"
        required
      />
      <button
        type="button"
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen((current) => !current)}
        aria-label="Show waiter names"
      >
        <ChevronDown className="h-4 w-4" />
      </button>
      {open && uniqueOptions.length > 0 ? (
        <div className="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border bg-white py-1 shadow-xl">
          {uniqueOptions.map((name) => (
            <button
              key={name}
              type="button"
              className={`block w-full px-3 py-2.5 text-left text-sm hover:bg-muted ${value === name ? "bg-muted font-semibold" : ""}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(name);
                setOpen(false);
              }}
            >
              {name}
            </button>
          ))}
        </div>
      ) : null}
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
