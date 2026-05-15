"use client";

import { useState } from "react";
import { Bell, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RequestButtons({
  orderId,
  restaurantSlug,
  tableNumber
}: {
  orderId?: string;
  restaurantSlug?: string;
  tableNumber?: number;
}) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState("");

  async function send(type: "CALL_WAITER" | "BILL_REQUEST") {
    setMessage("");
    setLoading(type);
    const response = await fetch("/api/customer/waiter-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, restaurantSlug, tableNumber, type })
    });
    const payload = await response.json().catch(() => ({}));
    setLoading("");
    setMessage(response.ok ? "Request sent to restaurant staff." : payload.error || "Could not send request. Please call staff.");
  }

  return (
    <div className="mt-5 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" onClick={() => send("CALL_WAITER")} disabled={Boolean(loading)}><Bell className="h-4 w-4" />Call Waiter</Button>
        <Button variant="secondary" onClick={() => send("BILL_REQUEST")} disabled={Boolean(loading)}><Receipt className="h-4 w-4" />Ask for Bill</Button>
      </div>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
