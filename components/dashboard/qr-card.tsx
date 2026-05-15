"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function QrCard({ tableNumber, url, baseUrl }: { tableNumber: number; url: string; baseUrl?: string }) {
  const [dataUrl, setDataUrl] = useState("");
  const origin = baseUrl || (typeof window === "undefined" ? "" : window.location.origin);
  const absoluteUrl = origin && url.startsWith("/") ? `${origin}${url}` : url;

  useEffect(() => {
    QRCode.toDataURL(absoluteUrl, { margin: 1, width: 260 }).then(setDataUrl);
  }, [absoluteUrl]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Table {tableNumber}</CardTitle>
        <p className="break-all text-xs text-muted-foreground">{absoluteUrl}</p>
      </CardHeader>
      <CardContent>
        {dataUrl ? <img src={dataUrl} alt={`QR code for table ${tableNumber}`} className="mx-auto h-44 w-44" /> : <div className="h-44" />}
        <div className="mt-4 grid grid-cols-3 gap-2">
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
