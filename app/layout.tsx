import type { Metadata } from "next";
import "./globals.css";
import { appBaseUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  metadataBase: new URL(appBaseUrl()),
  title: "OrderTable Pilot",
  description: "QR-based restaurant table ordering platform",
  robots: {
    index: true,
    follow: true
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
