// Shared reporting engine used by both the restaurant manager reports and the
// super admin platform reports. Provides date-range presets (Today, Yesterday,
// Last 7 / 30 / 90 days, and a custom "between" range) plus category-wise and
// department-wise sales aggregation.

const dayMs = 24 * 60 * 60 * 1000;
export const reportTimeZone = "Asia/Karachi";

export type ReportRangeKey = "today" | "yesterday" | "t7" | "t30" | "t90" | "custom";

export const reportRangePresets: { key: ReportRangeKey; label: string; shortLabel: string }[] = [
  { key: "today", label: "Today", shortLabel: "Today" },
  { key: "yesterday", label: "Yesterday", shortLabel: "Yesterday" },
  { key: "t7", label: "Last 7 days", shortLabel: "T7" },
  { key: "t30", label: "Last 30 days", shortLabel: "T30" },
  { key: "t90", label: "Last 90 days", shortLabel: "T90" },
  { key: "custom", label: "Custom range", shortLabel: "Between" }
];

export type ResolvedReportRange = {
  key: ReportRangeKey;
  fromStr: string;
  toStr: string;
  fromDate: Date;
  toExclusiveDate: Date;
  hasRange: boolean;
  label: string;
};

function isValidDateStr(value?: string): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime());
}

// YYYY-MM-DD for "now" in the report timezone (Asia/Karachi).
export function todayInReportZone(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: reportTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value || "0000";
  const month = parts.find((part) => part.type === "month")?.value || "01";
  const day = parts.find((part) => part.type === "day")?.value || "01";
  return `${year}-${month}-${day}`;
}

function addDaysStr(dateStr: string, days: number): string {
  // Parse and format in UTC so the calendar arithmetic is independent of the
  // server timezone (otherwise the date can shift by a day on non-UTC hosts).
  const next = new Date(new Date(`${dateStr}T00:00:00Z`).getTime() + days * dayMs);
  return next.toISOString().slice(0, 10);
}

function startOfDay(value: string) {
  return new Date(`${value}T00:00:00`);
}

function endExclusive(value: string) {
  return new Date(startOfDay(value).getTime() + dayMs);
}

// Resolves the active reporting window from a preset key (and optional custom
// from/to dates). For presets the window is computed relative to "today" in the
// report timezone; "custom" uses the supplied from/to dates.
export function resolveReportRange(
  rangeKey: string | undefined,
  from?: string,
  to?: string,
  now: Date = new Date()
): ResolvedReportRange {
  const today = todayInReportZone(now);
  const key = (reportRangePresets.find((preset) => preset.key === rangeKey)?.key || "t7") as ReportRangeKey;

  if (key === "custom") {
    const validFrom = isValidDateStr(from) ? from : "";
    const validTo = isValidDateStr(to) ? to : "";
    const hasRange = Boolean(validFrom && validTo && validFrom <= validTo);
    return {
      key,
      fromStr: validFrom,
      toStr: validTo,
      fromDate: hasRange ? startOfDay(validFrom) : startOfDay(today),
      toExclusiveDate: hasRange ? endExclusive(validTo) : endExclusive(today),
      hasRange,
      label: hasRange ? `${validFrom} to ${validTo}` : "Custom range"
    };
  }

  const spanByKey: Record<Exclude<ReportRangeKey, "custom">, number> = {
    today: 1,
    yesterday: 1,
    t7: 7,
    t30: 30,
    t90: 90
  };
  const span = spanByKey[key];
  const toStr = key === "yesterday" ? addDaysStr(today, -1) : today;
  const fromStr = addDaysStr(toStr, -(span - 1));
  const preset = reportRangePresets.find((item) => item.key === key);

  return {
    key,
    fromStr,
    toStr,
    fromDate: startOfDay(fromStr),
    toExclusiveDate: endExclusive(toStr),
    hasRange: true,
    label: preset ? preset.label : `${fromStr} to ${toStr}`
  };
}

// ---- Aggregation -----------------------------------------------------------

const UNCATEGORIZED = "Uncategorized";
const UNASSIGNED_DEPARTMENT = "Unassigned";

// Minimal shape needed for grouping. Orders carry items; each item may link to a
// menu item -> category -> department. Items without a menu item (manual entries)
// fall back to the Uncategorized / Unassigned buckets.
export type ReportOrderItem = {
  quantity: number;
  totalPrice: unknown;
  menuItem?: {
    category?: {
      name?: string | null;
      department?: { name?: string | null } | null;
    } | null;
  } | null;
};

export type ReportOrder = {
  id: string;
  status: string;
  items: ReportOrderItem[];
};

export type GroupedSalesRow = {
  name: string;
  quantity: number;
  revenue: number;
  orders: number;
  share: number;
};

function aggregateByKey(orders: ReportOrder[], keyForItem: (item: ReportOrderItem) => string): GroupedSalesRow[] {
  const map = new Map<string, { quantity: number; revenue: number; orderIds: Set<string> }>();
  for (const order of orders) {
    if (order.status === "CANCELLED") continue;
    for (const item of order.items) {
      const key = keyForItem(item);
      const current = map.get(key) || { quantity: 0, revenue: 0, orderIds: new Set<string>() };
      current.quantity += item.quantity;
      current.revenue += Number(item.totalPrice);
      current.orderIds.add(order.id);
      map.set(key, current);
    }
  }
  const totalRevenue = Array.from(map.values()).reduce((sum, value) => sum + value.revenue, 0);
  return Array.from(map.entries())
    .map(([name, value]) => ({
      name,
      quantity: value.quantity,
      revenue: value.revenue,
      orders: value.orderIds.size,
      share: totalRevenue > 0 ? (value.revenue / totalRevenue) * 100 : 0
    }))
    .sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity || a.name.localeCompare(b.name));
}

export function buildCategoryRows(orders: ReportOrder[]): GroupedSalesRow[] {
  return aggregateByKey(orders, (item) => item.menuItem?.category?.name?.trim() || UNCATEGORIZED);
}

export function buildDepartmentRows(orders: ReportOrder[]): GroupedSalesRow[] {
  return aggregateByKey(orders, (item) => item.menuItem?.category?.department?.name?.trim() || UNASSIGNED_DEPARTMENT);
}

// Prisma include needed to populate ReportOrder for the aggregation helpers.
export const reportOrderInclude = {
  items: {
    include: {
      menuItem: {
        include: {
          category: {
            include: { department: true }
          }
        }
      }
    }
  }
} as const;
