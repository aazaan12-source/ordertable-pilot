"use client";

import { useMemo, useState } from "react";
import { Bell, ChefHat, ClipboardList, QrCode, ReceiptText, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

const steps = [
  {
    key: "scan",
    title: "Customer scans QR",
    body: "Every table gets its own QR code. Guests open the menu without downloading an app.",
    hint: "Read-only example of the guest opening a table menu.",
    icon: QrCode
  },
  {
    key: "order",
    title: "Order goes live",
    body: "The manager dashboard receives the order automatically with table number, notes, and bill total.",
    hint: "Shows the dashboard flow without changing real orders.",
    icon: ClipboardList
  },
  {
    key: "kitchen",
    title: "Kitchen slip prints",
    body: "Kitchen gets a compact roll-printer slip focused only on food prep and instructions.",
    hint: "Explains printing; public visitors cannot print slips.",
    icon: ChefHat
  },
  {
    key: "bill",
    title: "Bill and waiter alerts",
    body: "Customers can call waiter or ask for bill. The dashboard announces the table with bell and voice.",
    hint: "Training preview of alerts and bill requests.",
    icon: Bell
  }
];

export function InteractiveDemo() {
  const [active, setActive] = useState(0);
  const current = steps[active];
  const Icon = current.icon;
  const progress = useMemo(() => `${((active + 1) / steps.length) * 100}%`, [active]);

  return (
    <section className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-primary">Live pilot flow</p>
          <h2 className="text-xl font-black">From table scan to paid bill</h2>
        </div>
        <div className="rounded-md bg-primary/10 p-3 text-primary">
          <Icon className="h-6 w-6" />
        </div>
      </div>

      <div className="mt-4 h-2 rounded-full bg-muted">
        <div className="h-2 rounded-full bg-primary transition-all" style={{ width: progress }} />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        {steps.map((step, index) => {
          const StepIcon = step.icon;
          return (
            <button
              key={step.key}
              onClick={() => setActive(index)}
              className={`rounded-md border p-3 text-left transition ${active === index ? "border-primary bg-primary text-primary-foreground" : "bg-white hover:bg-muted"}`}
            >
              <StepIcon className="mb-2 h-5 w-5" />
              <span className="text-sm font-bold">{step.title}</span>
              <span className={`mt-1 block text-[11px] leading-snug ${active === index ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                {step.hint}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-md bg-muted p-4">
          <p className="text-sm text-muted-foreground">Selected step</p>
          <h3 className="mt-1 text-2xl font-black">{current.title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{current.body}</p>
          <p className="mt-2 text-xs text-muted-foreground">Training note: this public demo only explains the operation. It does not edit menu data, create orders, or update restaurant records.</p>
          <div className="mt-4 flex gap-2">
            <Button type="button" variant="outline" onClick={() => setActive((value) => Math.max(0, value - 1))} disabled={active === 0}>
              Previous
            </Button>
            <Button type="button" onClick={() => setActive((value) => (value + 1) % steps.length)}>
              Next
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <PreviewCard icon={Smartphone} title="Customer" value="Table 7" body="2 x Burger, no mayo" />
          <PreviewCard icon={ChefHat} title="Kitchen" value="Slip ready" body="Serve drinks first" />
          <PreviewCard icon={ReceiptText} title="Billing" value="Rs. 1,650" body="Unpaid, print bill" />
        </div>
      </div>
    </section>
  );
}

function PreviewCard({
  icon: Icon,
  title,
  value,
  body
}: {
  icon: typeof Smartphone;
  title: string;
  value: string;
  body: string;
}) {
  return (
    <div className="rounded-md border bg-white p-3">
      <Icon className="h-5 w-5 text-primary" />
      <p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="font-black">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
    </div>
  );
}
