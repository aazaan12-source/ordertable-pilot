"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export function PrintControls() {
  return (
    <div className="no-print mb-4 flex gap-2">
      <Button onClick={() => window.print()}>Print</Button>
      <Link href="/dashboard/orders"><Button variant="outline">Back to Dashboard</Button></Link>
    </div>
  );
}
