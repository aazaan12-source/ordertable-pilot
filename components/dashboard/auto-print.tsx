"use client";

import { useEffect } from "react";

export function AutoPrint({
  orderId,
  type,
  logPrint = true,
  autoPrint = true
}: {
  orderId: string;
  type: "KITCHEN" | "BILL";
  logPrint?: boolean;
  autoPrint?: boolean;
}) {
  useEffect(() => {
    if (logPrint) {
      fetch(`/api/dashboard/orders/${orderId}/print`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type })
      }).catch(() => undefined);
    }

    if (!autoPrint) return undefined;
    const timer = window.setTimeout(() => {
      window.print();
    }, 500);
    return () => window.clearTimeout(timer);
  }, [autoPrint, logPrint, orderId, type]);

  return null;
}
