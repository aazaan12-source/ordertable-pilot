import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | string) {
  const amount = typeof value === "string" ? Number(value) : value;
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return `Rs. ${Math.round(safeAmount).toLocaleString("en-PK")}`;
}

export function formatPkTime(date: Date | string) {
  return new Intl.DateTimeFormat("en-PK", {
    timeZone: "Asia/Karachi",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short"
  }).format(new Date(date));
}

export function formatPkDateTime(date: Date | string) {
  return new Intl.DateTimeFormat("en-PK", {
    timeZone: "Asia/Karachi",
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(date));
}
