"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintPageButton({ label = "Print All QR Codes" }: { label?: string }) {
  return (
    <Button type="button" onClick={() => window.print()}>
      <Printer className="h-4 w-4" />
      {label}
    </Button>
  );
}

