"use client";

import { useState } from "react";
import { Printer, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DirectPrintButton({
  href,
  label,
  type = "kitchen",
  size = "md",
  className
}: {
  href: string;
  label: string;
  type?: "kitchen" | "bill";
  size?: "md" | "sm";
  className?: string;
}) {
  const [printSrc, setPrintSrc] = useState("");
  const Icon = type === "bill" ? Receipt : Printer;

  function startPrint() {
    const separator = href.includes("?") ? "&" : "?";
    setPrintSrc(`${href}${separator}directPrint=${Date.now()}`);
  }

  return (
    <>
      <Button type="button" variant="outline" size={size} className={className} onClick={startPrint}>
        <Icon className="h-4 w-4" />
        {label}
      </Button>
      {printSrc ? (
        <iframe
          key={printSrc}
          src={printSrc}
          title={`${label} print frame`}
          className="fixed -left-[9999px] top-0 h-[1200px] w-[90mm] border-0 opacity-0"
          aria-hidden="true"
        />
      ) : null}
    </>
  );
}
