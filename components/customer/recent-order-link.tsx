"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function RecentOrderLink({ restaurantSlug, tableNumber }: { restaurantSlug: string; tableNumber: number }) {
  const [orderId, setOrderId] = useState("");

  useEffect(() => {
    setOrderId(localStorage.getItem(`ordertable:${restaurantSlug}:${tableNumber}:lastOrder`) || "");
  }, [restaurantSlug, tableNumber]);

  if (!orderId) return null;

  return (
    <Link href={`/order/${orderId}/status`} className="mb-4 block rounded-md border border-primary/30 bg-white p-3 text-sm font-semibold text-primary">
      View your current order
    </Link>
  );
}
