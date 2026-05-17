"use client";

import { useState } from "react";
import { Printer, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DirectPrintButton({
  href,
  label,
  type = "kitchen",
  size = "md",
  className
}: {
  href: string;
  label: string;
  type?: "kitchen" | "bill";
  size?: "md" | "sm";
  className?: string;
}) {
  const [printSrc, setPrintSrc] = useState("");
  const [printing, setPrinting] = useState(false);
  const Icon = type === "bill" ? Receipt : Printer;

  async function startPrint() {
    if (printing) return;
    setPrinting(true);
    const separator = href.includes("?") ? "&" : "?";
    const cacheBustedHref = `${href}${separator}directPrint=${Date.now()}`;
    try {
      const agentHref = `${href}${separator}agentPrint=1&directPrint=${Date.now()}`;
      const absoluteUrl = new URL(agentHref, window.location.origin).toString();
      const page = await fetch(agentHref, { credentials: "include", cache: "no-store" });
      if (!page.ok) throw new Error("print page unavailable");
      const html = await page.text();
      const agent = await fetch("http://127.0.0.1:17777/print-html", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html, sourceUrl: absoluteUrl, title: label })
      });
      if (!agent.ok) throw new Error("local print agent unavailable");
      await logPrint(href, type);
    } catch {
      setPrintSrc(cacheBustedHref);
    } finally {
      window.setTimeout(() => setPrinting(false), 1200);
    }
  }

  return (
    <>
      <Button type="button" variant="outline" size={size} className={className} onClick={startPrint} disabled={printing}>
        <Icon className="h-4 w-4" />
        {printing ? "Printing..." : label}
      </Button>
      {printSrc ? (
        <iframe
          key={printSrc}
          src={printSrc}
          title={`${label} print frame`}
          className="fixed -left-[9999px] top-0 h-[1200px] w-[90mm] border-0 opacity-0"
          aria-hidden="true"
        />
      ) : null}
    </>
  );
}

async function logPrint(href: string, type: "kitchen" | "bill") {
  const match = href.match(/\/dashboard\/orders\/([^/]+)\/print\//);
  const orderId = match?.[1];
  if (!orderId) return;
  await fetch(`/api/dashboard/orders/${orderId}/print`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: type === "bill" ? "BILL" : "KITCHEN" })
  }).catch(() => undefined);
}
