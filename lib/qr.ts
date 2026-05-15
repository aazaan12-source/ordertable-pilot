import QRCode from "qrcode";

export function tableQrUrl(slug: string, tableNumber: number) {
  return `/r/${slug}/t/${tableNumber}`;
}

export function absoluteTableQrUrl(slug: string, tableNumber: number) {
  const baseUrl = (process.env.APP_URL || process.env.NEXTAUTH_URL || "").replace(/\/$/, "");
  return baseUrl ? `${baseUrl}${tableQrUrl(slug, tableNumber)}` : tableQrUrl(slug, tableNumber);
}

export async function qrDataUrl(value: string) {
  return QRCode.toDataURL(value, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 320,
    color: {
      dark: "#0f2a24",
      light: "#ffffff"
    }
  });
}
