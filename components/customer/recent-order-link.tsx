"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function RecentOrderLink({ restaurantSlug, tableNumber }: { restaurantSlug: string; tableNumber: number }) {
  const [orderId, setOrderId] = useState("");
  const [order, setOrder] = useState<{ orderNumber: string; status: string; statusLabel: string } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const key = `ordertable:${restaurantSlug}:${tableNumber}:lastOrder`;
    const stored = localStorage.getItem(key) || "";
    setOrderId(stored);
    if (!stored) return;

    fetch(`/api/customer/orders/${stored}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!payload?.order) return;
        if (payload.order.status === "PAID" || payload.order.status === "CANCELLED") {
          localStorage.removeItem(key);
          setOrderId("");
          return;
        }
        setOrder(payload.order);
      })
      .catch(() => undefined);
  }, [restaurantSlug, tableNumber]);

  if (!orderId || dismissed) return null;

  return (
    <div className="mb-4 rounded-lg border border-primary/30 bg-white p-4 shadow-sm">
      <p className="text-sm font-bold text-primary">You have a running order{order ? `: ${order.orderNumber}` : ""}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {order ? `Current status: ${order.statusLabel}.` : "You can view your running order or start a separate new order."}
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Link href={`/order/${orderId}/status`}>
          <Button className="w-full">View Running Order</Button>
        </Link>
        <Button variant="outline" onClick={() => setDismissed(true)}>Place New Order</Button>
      </div>
    </div>
  );
}
