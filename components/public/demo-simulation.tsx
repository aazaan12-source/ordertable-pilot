"use client";

import Link from "next/link";
import { ArrowRight, ClipboardList, QrCode, ScanLine, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DemoQr = {
  tableNumber: number;
  url: string;
  dataUrl: string;
};

export function DemoSimulation({ qrCodes }: { qrCodes: DemoQr[] }) {
  return (
    <section id="demo-simulation" className="overflow-hidden rounded-lg border bg-white shadow-sm">
      <div className="grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="bg-[#103a31] p-5 text-white md:p-7">
          <p className="w-fit rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wide">Hands-on demo simulation</p>
          <h2 className="mt-4 text-3xl font-black leading-tight">Try the QR ordering flow like a real restaurant.</h2>
          <p className="mt-3 text-sm leading-6 text-white/82">
            Open the demo dashboard, scan one of the five table QR codes, place a test order, then move that order through the same live-order actions a manager uses.
          </p>

          <div className="mt-6 grid gap-3">
            <DemoStep icon={ClipboardList} title="1. Open demo dashboard" body="Keep the live-order screen open as the receiver side." />
            <DemoStep icon={ScanLine} title="2. Scan or open a table QR" body="Use any of the 5 demo tables to open a customer order page." />
            <DemoStep icon={Smartphone} title="3. Place order and act on it" body="Accept, prepare, serve, request bill, and mark paid in the demo dashboard." />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/demo/simulation/dashboard?session=public-demo" target="_blank">
              <Button size="lg" className="bg-white text-[#103a31] hover:bg-white/90">
                Open Demo Dashboard <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/demo/simulation/order?table=1&session=public-demo" target="_blank">
              <Button size="lg" variant="outline" className="border-white/35 bg-white/10 text-white hover:bg-white hover:text-[#103a31]">
                Open Table 1 Order Page
              </Button>
            </Link>
          </div>
          <p className="mt-4 rounded-md border border-white/20 bg-white/10 p-3 text-xs leading-5 text-white/78">
            This demo is safe: it runs in the visitor browser, does not edit real restaurant records, and keeps manager-only features read-only.
          </p>
        </div>

        <div className="p-5 md:p-7">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-primary">Demo tables</p>
              <h3 className="text-2xl font-black">Scan a QR or open directly</h3>
            </div>
            <div className="rounded-md bg-primary/10 p-3 text-primary">
              <QrCode className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {qrCodes.map((qr) => (
              <Card key={qr.tableNumber} className="overflow-hidden">
                <CardHeader className="p-3 pb-2">
                  <CardTitle className="text-base">Table {qr.tableNumber}</CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <div className="rounded-md border bg-white p-2">
                    <img src={qr.dataUrl} alt={`Demo table ${qr.tableNumber} QR code`} className="mx-auto aspect-square w-full max-w-[132px]" />
                  </div>
                  <Link href={qr.url} target="_blank">
                    <Button className="mt-3 w-full" variant="outline" size="sm">Open</Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-4 rounded-md bg-muted p-3 text-xs leading-5 text-muted-foreground">
            Tip: for the clearest public test, open the demo dashboard in one tab and open a table order page in another tab on the same device. Same-browser tabs update instantly through demo sync.
          </div>
        </div>
      </div>
    </section>
  );
}

function DemoStep({ icon: Icon, title, body }: { icon: typeof ClipboardList; title: string; body: string }) {
  return (
    <div className="flex gap-3 rounded-md border border-white/15 bg-white/10 p-3">
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-white" />
      <div>
        <p className="font-bold">{title}</p>
        <p className="mt-1 text-xs leading-5 text-white/75">{body}</p>
      </div>
    </div>
  );
}
