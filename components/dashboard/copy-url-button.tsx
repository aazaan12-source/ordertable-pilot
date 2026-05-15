"use client";

import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopyUrlButton({ url }: { url: string }) {
  const fullUrl = url.startsWith("http") ? url : `${window.location.origin}${url}`;
  return (
    <Button
      variant="outline"
      className="mt-3 w-full"
      onClick={() => navigator.clipboard.writeText(fullUrl)}
    >
      <Copy className="h-4 w-4" />
      Copy QR URL
    </Button>
  );
}
