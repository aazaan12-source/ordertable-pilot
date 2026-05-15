"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function OrderActionButtons({ orderId, canEdit }: { orderId: string; canEdit: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function cancelOrder() {
    if (!confirm("Cancel this order?")) return;
    setLoading(true);
    const response = await fetch(`/api/customer/orders/${orderId}`, { method: "DELETE" });
    setLoading(false);
    if (!response.ok) {
      const payload = await response.json();
      setMessage(payload.error || "Could not cancel this order.");
      return;
    }
    setMessage("Order cancelled.");
    router.refresh();
  }

  if (!canEdit) {
    return <p className="mt-4 rounded-md bg-muted p-3 text-sm">Editing and cancellation are available only before the restaurant accepts the order.</p>;
  }

  return (
    <div className="mt-5 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" onClick={() => router.push(`/order/${orderId}/edit`)}>
          <Pencil className="h-4 w-4" />
          Edit Order
        </Button>
        <Button variant="destructive" onClick={cancelOrder} disabled={loading}>
          <XCircle className="h-4 w-4" />
          Cancel
        </Button>
      </div>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
