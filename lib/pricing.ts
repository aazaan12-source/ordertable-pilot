import { Prisma } from "@prisma/client";

export function toNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value === null || value === undefined) return 0;
  return typeof value === "number" ? value : Number(value.toString());
}

export function calculateTotals(
  itemTotals: number[],
  serviceChargePercent: Prisma.Decimal | number | string,
  taxPercent: Prisma.Decimal | number | string,
  discountInput: Prisma.Decimal | number | string = 0
) {
  const subtotal = itemTotals.reduce((sum, value) => sum + value, 0);
  const serviceCharges = Math.round((subtotal * toNumber(serviceChargePercent)) / 100);
  const tax = Math.round(((subtotal + serviceCharges) * toNumber(taxPercent)) / 100);
  const discount = Math.max(0, Math.round(toNumber(discountInput)));
  const total = Math.max(0, subtotal + serviceCharges + tax - discount);
  return { subtotal, serviceCharges, tax, discount, total };
}
