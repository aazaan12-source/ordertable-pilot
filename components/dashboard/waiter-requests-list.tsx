"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPkTime } from "@/lib/utils";

const resolvedEventName = "ordertable-waiter-request-resolved";

type Request = {
  id: string;
  type: string;
  status: string;
  createdAt: string;
  table: { tableNumber: number };
  order: { orderNumber: string } | null;
};

export function WaiterRequestsList({ initialRequests }: { initialRequests: Request[] }) {
  const [requests, setRequests] = useState(initialRequests);
  const [warning, setWarning] = useState("");

  async function loadRequests() {
    try {
      const response = await fetch("/api/dashboard/waiter-requests", { cache: "no-store" });
      if (!response.ok) throw new Error("request load failed");
      const payload = await response.json();
      setRequests(payload.requests);
      setWarning("");
    } catch {
      setWarning("Connection issue. Retrying...");
    }
  }

  useEffect(() => {
    const timer = setInterval(loadRequests, 1000);
    return () => clearInterval(timer);
  }, []);

  async function resolve(id: string) {
    const previous = requests;
    setRequests((current) => current.filter((request) => request.id !== id));
    try {
      const response = await fetch(`/api/dashboard/waiter-requests/${id}/resolve`, { method: "PATCH" });
      if (!response.ok) throw new Error("resolve failed");
      window.dispatchEvent(new CustomEvent(resolvedEventName, { detail: id }));
      setWarning("");
    } catch {
      setRequests(previous);
      setWarning("Could not acknowledge this request. Please try again.");
    }
  }

  if (requests.length === 0) {
    return (
      <div>
        {warning ? <p className="mb-3 rounded-md border border-orange-300 bg-orange-50 p-3 text-sm text-orange-900">{warning}</p> : null}
        <p className="rounded-md border bg-white p-6 text-center text-muted-foreground">No pending waiter requests.</p>
      </div>
    );
  }

  return (
    <>
      {warning ? <p className="mb-3 rounded-md border border-orange-300 bg-orange-50 p-3 text-sm text-orange-900">{warning}</p> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {requests.map((request) => (
          <Card key={request.id} className={request.type === "BILL_REQUEST" ? "border-primary" : ""}>
            <CardHeader>
              <CardTitle>Table {request.table.tableNumber}</CardTitle>
              <p className="text-sm text-muted-foreground">{formatPkTime(request.createdAt)}</p>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-bold">{request.type.replaceAll("_", " ")}</p>
              {request.order ? <p className="text-sm text-muted-foreground">Order {request.order.orderNumber}</p> : null}
              <Button className="mt-4 w-full" onClick={() => resolve(request.id)}>Mark resolved</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
