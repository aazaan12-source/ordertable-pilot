"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function TableQrImage({ url }: { url: string }) {
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 180 }).then(setDataUrl);
  }, [url]);

  if (!dataUrl) return <div className="mx-auto h-32 w-32 rounded-md bg-muted" />;

  return <img src={dataUrl} alt={`QR code for ${url}`} className="mx-auto h-32 w-32" />;
}
