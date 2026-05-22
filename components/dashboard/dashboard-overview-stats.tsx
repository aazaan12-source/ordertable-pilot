"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FinancialAmount } from "@/components/dashboard/financial-amount";

type Summary = {
  pending: number;
  paid: number;
  revenue: string;
  waiterRequests: number;
};

export function DashboardOverviewStats({ initialSummary }: { initialSummary: Summary }) {
  const [summary, setSummary] = useState(initialSummary);
  const [connected, setConnected] = useState(false);
  const connectedRef = useRef(false);

  async function loadSummary() {
    try {
      const response = await fetch(`/api/dashboard/summary?t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-store" }
      });
      if (!response.ok) return;
      setSummary(await response.json());
    } catch {
      // The live stream reconnect loop will keep trying.
    }
  }

  useEffect(() => {
    if (typeof EventSource === "undefined") {
      const timer = window.setInterval(loadSummary, 1000);
      void loadSummary();
      return () => window.clearInterval(timer);
    }

    let closedByCleanup = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let fallbackTimer: number | undefined;
    let source: EventSource | undefined;

    const connect = () => {
      if (closedByCleanup) return;
      source?.close();
      source = new EventSource(`/api/dashboard/summary/stream?t=${Date.now()}`);
      source.addEventListener("open", () => {
        connectedRef.current = true;
        setConnected(true);
      });
      source.addEventListener("summary", (event) => {
        try {
          setSummary(JSON.parse((event as MessageEvent).data));
          connectedRef.current = true;
          setConnected(true);
        } catch {
          connectedRef.current = false;
          setConnected(false);
        }
      });
      source.addEventListener("error", () => {
        connectedRef.current = false;
        setConnected(false);
        source?.close();
        if (closedByCleanup) return;
        void loadSummary();
        reconnectTimer = setTimeout(connect, 1000);
      });
    };

    connect();
    fallbackTimer = window.setInterval(() => {
      if (!connectedRef.current) void loadSummary();
    }, 1500);

    return () => {
      closedByCleanup = true;
      source?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (fallbackTimer) clearInterval(fallbackTimer);
    };
  }, []);

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <span className={connected ? "rounded-full bg-green-100 px-2 py-1 text-xs font-bold text-green-800" : "rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800"}>
          {connected ? "Live connected" : "Reconnecting live data"}
        </span>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Link href="/dashboard/orders?status=PENDING#live-orders" className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Stat title="Pending orders" value={summary.pending} actionText="Open pending live orders" interactive />
        </Link>
        <Stat title="Paid orders" value={summary.paid} />
        <Stat title="Revenue today" value={<FinancialAmount value={summary.revenue} />} />
        <Stat title="Open requests" value={summary.waiterRequests} />
      </div>
    </div>
  );
}

function Stat({ title, value, actionText, interactive = false }: { title: string; value: React.ReactNode; actionText?: string; interactive?: boolean }) {
  return (
    <Card className={interactive ? "transition hover:border-primary hover:shadow-sm active:translate-y-px" : ""}>
      <CardHeader><CardTitle className="text-sm text-muted-foreground">{title}</CardTitle></CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{value}</p>
        {actionText ? <p className="mt-2 text-xs font-semibold text-primary">{actionText}</p> : null}
      </CardContent>
    </Card>
  );
}
