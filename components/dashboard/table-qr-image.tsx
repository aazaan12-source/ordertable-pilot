"use client";

import { useEffect, useState } from "react";
import { createQrSignDataUrl } from "@/components/dashboard/qr-sign";

export function TableQrImage({ url, tableNumber, restaurantName }: { url: string; tableNumber: number; restaurantName?: string }) {
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    createQrSignDataUrl(url, tableNumber, restaurantName).then((nextDataUrl) => {
      if (!cancelled) setDataUrl(nextDataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [restaurantName, tableNumber, url]);

  if (!dataUrl) return <div className="mx-auto aspect-[3/4] w-full max-w-[220px] rounded-md bg-muted" />;

  return <img src={dataUrl} alt={`QR code sign for table ${tableNumber}`} className="mx-auto w-full max-w-[220px] rounded-md border bg-white" />;
}
