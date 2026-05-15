"use client";

import { formatCurrency } from "@/lib/utils";
import { useHideFinancials } from "@/components/dashboard/financial-privacy-toggle";

export function FinancialAmount({ value, fallback }: { value: number | string; fallback?: string }) {
  const hidden = useHideFinancials();
  if (hidden) return <span>Rs. *****</span>;
  return <span>{fallback || formatCurrency(value)}</span>;
}
