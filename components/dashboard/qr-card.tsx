"use client";

import { useEffect, useState } from "react";
import { Copy, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createQrSignDataUrl } from "@/components/dashboard/qr-sign";

export function QrCard({ tableNumber, url, baseUrl, restaurantName }: { tableNumber: number; url: string; baseUrl?: string; restaurantName?: string }) {
  const [dataUrl, setDataUrl] = useState("");
  const origin = baseUrl || (typeof window === "undefined" ? "" : window.location.origin);
  const absoluteUrl = origin && url.startsWith("/") ? `${origin}${url}` : url;

  useEffect(() => {
    let cancelled = false;
    createQrSignDataUrl(absoluteUrl, tableNumber, restaurantName).then((nextDataUrl) => {
      if (!cancelled) setDataUrl(nextDataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [absoluteUrl, restaurantName, tableNumber]);

  return (
    <Card className="break-inside-avoid print:border-0 print:shadow-none">
      <CardHeader className="print:hidden">
        <CardTitle>Table {tableNumber}</CardTitle>
        <p className="break-all text-xs text-muted-foreground">{absoluteUrl}</p>
      </CardHeader>
      <CardContent className="print:p-0">
        {dataUrl ? (
          <img src={dataUrl} alt={`QR code sign for table ${tableNumber}`} className="mx-auto w-full max-w-[280px] rounded-md border bg-white print:max-w-[320px] print:border-0" />
        ) : (
          <div className="mx-auto aspect-[3/4] w-full max-w-[280px] rounded-md bg-muted" />
        )}
        <div className="mt-4 grid grid-cols-3 gap-2 print:hidden">
          <Button variant="outline" onClick={() => navigator.clipboard.writeText(absoluteUrl)}><Copy className="h-4 w-4" />Copy</Button>
          <a href={dataUrl} download={`table-${tableNumber}-qr.png`}>
            <Button className="w-full" variant="secondary"><Download className="h-4 w-4" />PNG</Button>
          </a>
          <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" />Print</Button>
        </div>
      </CardContent>
    </Card>
  );
}
