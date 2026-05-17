"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const scanInstruction = "Place Order to the Counter OR Call Waiter by Scanning this QR Code through Google Lens";

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

async function createQrSignDataUrl(url: string, tableNumber: number, restaurantName?: string) {
  const canvas = document.createElement("canvas");
  const width = 900;
  const height = 1200;
  const qrSize = 650;
  const qrX = (width - qrSize) / 2;
  const qrY = 220;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return "";

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "#0f172a";
  context.lineWidth = 10;
  roundedRect(context, 20, 20, width - 40, height - 40, 34);
  context.stroke();

  context.fillStyle = "#0f172a";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "900 86px Arial, sans-serif";
  context.fillText(`TABLE ${tableNumber}`, width / 2, 92);

  if (restaurantName) {
    context.fillStyle = "#475569";
    context.font = "700 34px Arial, sans-serif";
    context.fillText(restaurantName, width / 2, 158);
  }

  const qrDataUrl = await QRCode.toDataURL(url, {
    errorCorrectionLevel: "H",
    margin: 1,
    width: qrSize,
    color: {
      dark: "#0f172a",
      light: "#ffffff"
    }
  });
  const qrImage = await loadImage(qrDataUrl);
  context.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

  drawTableBadge(context, width / 2, qrY + qrSize / 2, tableNumber);

  context.fillStyle = "#0f172a";
  context.font = "900 44px Arial, sans-serif";
  wrapText(context, scanInstruction, width / 2, 940, 760, 58);

  context.fillStyle = "#64748b";
  context.font = "600 24px Arial, sans-serif";
  context.fillText(url, width / 2, 1130, 760);

  return canvas.toDataURL("image/png");
}

function drawTableBadge(context: CanvasRenderingContext2D, centerX: number, centerY: number, tableNumber: number) {
  const badgeWidth = 220;
  const badgeHeight = 138;
  const x = centerX - badgeWidth / 2;
  const y = centerY - badgeHeight / 2;
  context.fillStyle = "#ffffff";
  roundedRect(context, x, y, badgeWidth, badgeHeight, 22);
  context.fill();
  context.strokeStyle = "#0f172a";
  context.lineWidth = 8;
  context.stroke();
  context.fillStyle = "#0f172a";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "900 30px Arial, sans-serif";
  context.fillText("TABLE", centerX, centerY - 34);
  context.font = "900 76px Arial, sans-serif";
  context.fillText(String(tableNumber), centerX, centerY + 28);
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function wrapText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (context.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = testLine;
    }
  }
  if (line) lines.push(line);
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((currentLine, index) => context.fillText(currentLine, x, startY + index * lineHeight));
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}
