"use client";

import QRCode from "qrcode";

export const scanInstruction = "Place Order to the Counter OR Call Waiter by Scanning this QR Code through Google Lens";

export async function createQrSignDataUrl(url: string, tableNumber: number, restaurantName?: string) {
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
