"use client";

import { useEffect } from "react";

export function AutoPrint({ orderId, type }: { orderId: string; type: "KITCHEN" | "BILL" }) {
  useEffect(() => {
    fetch(`/api/dashboard/orders/${orderId}/print`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type })
    }).catch(() => undefined);

    const timer = window.setTimeout(() => {
      window.print();
    }, 500);
    return () => window.clearTimeout(timer);
  }, [orderId, type]);

  return null;
}
