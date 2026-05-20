"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function PrintControls({ autoPrint = false }: { autoPrint?: boolean }) {
  useEffect(() => {
    if (!autoPrint) return;
    const timer = window.setTimeout(() => window.print(), 350);
    return () => window.clearTimeout(timer);
  }, [autoPrint]);

  return (
    <div className="no-print mb-4 flex gap-2">
      <Button onClick={() => window.print()}>Print</Button>
      <Link href="/dashboard/orders"><Button variant="outline">Back to Dashboard</Button></Link>
    </div>
  );
}
