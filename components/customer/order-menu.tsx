"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";
import { menuImageFor } from "@/lib/menu-images";

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

export function OrderMenu({
  restaurant,
  tableNumber,
  categories,
  items,
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
  categories: { id: string; name: string }[];
  items: MenuItem[];
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
  const [error, setError] = useState("");
  const [placing, setPlacing] = useState(false);

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
    setPlacing(true);
    setError("");
    try {
      const response = await fetch(editOrder ? `/api/customer/orders/${editOrder.id}` : "/api/customer/orders", {
        method: editOrder ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantSlug: restaurant.slug,
          tableNumber,
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
    <div className="min-h-screen pb-28">
      <header className="sticky top-0 z-10 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">OrderTable</p>
            <h1 className="text-xl font-bold">{editOrder ? `Edit ${editOrder.orderNumber}` : restaurant.name}</h1>
            <p className="text-sm text-muted-foreground">{[restaurant.branchName, restaurant.city].filter(Boolean).join(", ")}</p>
          </div>
          <div className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Table {tableNumber}</div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5">
        {editOrder ? (
          <Link href={`/order/${editOrder.id}/status`} className="mb-4 block rounded-md border bg-white p-3 text-sm font-semibold text-primary">
            Back to order status
          </Link>
        ) : null}
        <div className="grid gap-5 lg:grid-cols-[190px_1fr]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-lg border bg-white p-3">
              <p className="mb-2 px-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Categories</p>
              <div className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-2 lg:overflow-visible">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setActiveCategory(category.id)}
                    className={`w-full shrink-0 rounded-md px-3 py-2 text-left text-sm font-semibold transition ${
                      activeCategory === category.id ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-border"
                    }`}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <div className="grid gap-4 md:grid-cols-2">
            {visibleItems.map((item) => {
              const cartItem = cartById.get(item.id);
              return (
                <Card key={item.id} className="overflow-hidden">
                  <img
                    src={menuImageFor(item.name, item.category.name, item.imageUrl)}
                    alt={item.name}
                    className="h-44 w-full object-cover"
                    loading="lazy"
                  />
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-semibold">{item.name}</h2>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
                      </div>
                      <p className="shrink-0 font-bold">{formatCurrency(item.price)}</p>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      {cartItem ? (
                        <div className="flex items-center gap-2">
                          <Button size="icon" variant="outline" onClick={() => changeQty(item.id, -1)}><Minus className="h-4 w-4" /></Button>
                          <span className="w-8 text-center font-semibold">{cartItem.quantity}</span>
                          <Button size="icon" variant="outline" onClick={() => changeQty(item.id, 1)}><Plus className="h-4 w-4" /></Button>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Freshly prepared</span>
                      )}
                      <Button onClick={() => addItem(item)}>{cartItem ? "Add more" : "Add"}</Button>
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

      <div className="fixed inset-x-0 bottom-0 border-t bg-white p-4 shadow-lg">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{totalQty} items</p>
            <p className="text-lg font-bold">{formatCurrency(estimatedTotal)}</p>
            <p className="text-xs text-muted-foreground">Estimated total</p>
          </div>
          <Button size="lg" disabled={cart.length === 0 || placing} onClick={placeOrder}>
            <ShoppingCart className="h-5 w-5" />
            {placing ? "Sending..." : editOrder ? "Save changes" : "Place order"}
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
