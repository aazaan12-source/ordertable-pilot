"use client";

import { useState } from "react";
import { Bell, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RequestButtons({
  orderId,
  restaurantSlug,
  tableNumber,
  pinnedMobile = false
}: {
  orderId?: string;
  restaurantSlug?: string;
  tableNumber?: number;
  pinnedMobile?: boolean;
}) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState("");
  const [cooldown, setCooldown] = useState("");

  async function send(type: "CALL_WAITER" | "BILL_REQUEST") {
    if (loading || cooldown === type) return;
    setMessage("");
    setLoading(type);
    const response = await fetch("/api/customer/waiter-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, restaurantSlug, tableNumber, type })
    });
    const payload = await response.json().catch(() => ({}));
    setLoading("");
    if (response.ok) {
      setMessage(payload.duplicate ? "Request already sent. Restaurant staff has been notified." : "Request sent to restaurant staff.");
      setCooldown(type);
      window.setTimeout(() => setCooldown((current) => (current === type ? "" : current)), 8000);
    } else {
      setMessage(payload.error || "Could not send request. Please call staff.");
    }
  }

  return (
    <div className={pinnedMobile ? "fixed inset-x-0 bottom-[86px] z-40 border-t bg-white/95 px-3 py-2 shadow-lg backdrop-blur sm:static sm:mt-5 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none" : "mt-5 space-y-3"}>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" onClick={() => send("CALL_WAITER")} disabled={Boolean(loading) || cooldown === "CALL_WAITER"}><Bell className="h-4 w-4" />{loading === "CALL_WAITER" ? "Sending..." : "Call Waiter"}</Button>
        <Button variant="secondary" onClick={() => send("BILL_REQUEST")} disabled={Boolean(loading) || cooldown === "BILL_REQUEST"}><Receipt className="h-4 w-4" />{loading === "BILL_REQUEST" ? "Sending..." : "Ask for Bill"}</Button>
      </div>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
