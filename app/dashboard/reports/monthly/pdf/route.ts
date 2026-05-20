import { NextRequest } from "next/server";
import { OrderSource, PaymentMethod, PaymentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getManagerRestaurant } from "@/lib/permissions";
import { orderSourceLabels } from "@/lib/order-utils";
import { formatCurrency, formatPkDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ProductRow = {
  itemName: string;
  quantity: number;
  revenue: number;
  orders: number;
  share: number;
};

const dayMs = 24 * 60 * 60 * 1000;
const reportTimeZone = "Asia/Karachi";

export async function GET(request: NextRequest) {
  const { restaurant } = await getManagerRestaurant();
  const query = request.nextUrl.searchParams;
  const dateRange = resolveDateRange(query);
  const selectedTableNumber = positiveInt(query.get("tableNumber") || undefined);
  const source = enumValue(query.get("source") || undefined, OrderSource);
  const paymentStatus = enumValue(query.get("paymentStatus") || undefined, PaymentStatus);
  const paymentMethod = enumValue(query.get("paymentMethod") || undefined, PaymentMethod);

  const tables = await db.restaurantTable.findMany({
    where: { restaurantId: restaurant.id, status: { not: "INACTIVE" } },
    select: { id: true, tableNumber: true }
  });
  const selectedTable = selectedTableNumber ? tables.find((table) => table.tableNumber === selectedTableNumber) : null;
  const where = {
    restaurantId: restaurant.id,
    createdAt: { gte: dateRange.start, lt: dateRange.end },
    ...(selectedTable ? { tableId: selectedTable.id } : {}),
    ...(source ? { source } : {}),
    ...(paymentStatus ? { paymentStatus } : {}),
    ...(paymentMethod ? { paymentMethod } : {})
  };

  const orders = await db.order.findMany({
    where,
    include: { table: true, items: true },
    orderBy: { createdAt: "asc" }
  });
  const nonCancelled = orders.filter((order) => order.status !== "CANCELLED");
  const paid = orders.filter((order) => order.paymentStatus === "PAID");
  const grossSales = nonCancelled.reduce((sum, order) => sum + Number(order.subtotal), 0);
  const discounts = nonCancelled.reduce((sum, order) => sum + Number(order.discount), 0);
  const serviceCharges = nonCancelled.reduce((sum, order) => sum + Number(order.serviceCharges), 0);
  const tax = nonCancelled.reduce((sum, order) => sum + Number(order.tax), 0);
  const netSales = paid.reduce((sum, order) => sum + Number(order.total), 0);
  const averageOrder = paid.length ? netSales / paid.length : 0;
  const itemRows = productRows(nonCancelled);
  const byPayment = groupTotals(paid, (order) => order.paymentMethod || "UNSELECTED");
  const bySource = groupTotals(nonCancelled, (order) => orderSourceLabels[order.source] || order.source);
  const byTable = groupTotals(nonCancelled, (order) => `Table ${order.table.tableNumber}`);
  const byDay = dailyRevenueRows(nonCancelled);

  const lines = [
    "Revenue and Product Performance Report",
    restaurant.name,
    `${restaurant.branchName || ""}${restaurant.branchName && restaurant.city ? " - " : ""}${restaurant.city || ""}`,
    `Period: ${dateRange.from} to ${dateRange.to}`,
    `Generated: ${formatPkDateTime(new Date())}`,
    `Filters: ${selectedTableNumber ? `Table ${selectedTableNumber}` : "All tables"}${source ? ` - ${orderSourceLabels[source] || source}` : " - All sources"}${paymentStatus ? ` - ${paymentStatus}` : " - All payment statuses"}${paymentMethod ? ` - ${paymentMethod}` : " - All payment methods"}`,
    "",
    "1. Revenue Summary",
    `Total orders: ${orders.length}`,
    `Paid orders: ${paid.length}`,
    `Unpaid orders: ${orders.filter((order) => order.paymentStatus === "UNPAID").length}`,
    `Cancelled orders: ${orders.filter((order) => order.status === "CANCELLED").length}`,
    `Gross item sales: ${formatCurrency(grossSales)}`,
    `Discounts: ${formatCurrency(discounts)}`,
    `Service charges: ${formatCurrency(serviceCharges)}`,
    `Tax: ${formatCurrency(tax)}`,
    `Net paid revenue: ${formatCurrency(netSales)}`,
    `Average paid order: ${formatCurrency(averageOrder)}`,
    "",
    "2. Product Revenue Ranking",
    ...tableLines(["Rank", "Menu item", "Qty", "Orders", "Revenue", "Share"], itemRows.map((item, index) => [
      String(index + 1),
      item.itemName,
      String(item.quantity),
      String(item.orders),
      formatCurrency(item.revenue),
      `${item.share.toFixed(1)}%`
    ])),
    "",
    "3. Daily Revenue",
    ...tableLines(["Date", "Day", "Orders", "Revenue"], byDay.map((row) => [row.date, row.dayName, String(row.orders), formatCurrency(row.total)])),
    "",
    "4. Table Revenue",
    ...tableLines(["Table", "Orders", "Revenue"], byTable.map((row) => [row.label, String(row.orders), formatCurrency(row.total)])),
    "",
    "5. Revenue by Payment Method",
    ...tableLines(["Method", "Orders", "Revenue"], byPayment.map((row) => [row.label, String(row.orders), formatCurrency(row.total)])),
    "",
    "6. Revenue by Order Source",
    ...tableLines(["Source", "Orders", "Revenue"], bySource.map((row) => [row.label, String(row.orders), formatCurrency(row.total)])),
    "",
    "7. Order History",
    ...tableLines(["Time", "Order", "Table", "Source", "Status", "Total"], orders.map((order) => [
      formatPkDateTime(order.createdAt),
      order.orderNumber,
      String(order.table.tableNumber),
      orderSourceLabels[order.source] || order.source,
      order.status,
      formatCurrency(order.total.toString())
    ])),
    "",
    "Notes: Cancelled orders are listed for control but excluded from revenue and product-performance totals."
  ];

  const pdf = createTextPdf(lines);
  const filename = `${slugify(restaurant.name)}-report-${dateRange.from}-to-${dateRange.to}.pdf`;
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store, max-age=0"
    }
  });
}

function createTextPdf(lines: string[]) {
  const pageWidth = 595;
  const pageHeight = 842;
  const marginX = 42;
  const startY = 800;
  const lineHeight = 14;
  const maxChars = 96;
  const pages: string[][] = [[]];

  for (const line of lines) {
    const wrapped = wrapLine(line, maxChars);
    for (const nextLine of wrapped) {
      if (pages[pages.length - 1].length >= 52) pages.push([]);
      pages[pages.length - 1].push(nextLine);
    }
  }

  const objects: string[] = [];
  const addObject = (body: string) => {
    objects.push(body);
    return objects.length;
  };
  const catalogId = addObject("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesId = addObject("");
  const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>");
  const pageIds: number[] = [];

  for (const pageLines of pages) {
    const content = pageLines.map((line, index) => {
      const y = startY - index * lineHeight;
      return `BT /F1 9 Tf ${marginX} ${y} Td (${escapePdfText(line)}) Tj ET`;
    }).join("\n");
    const contentId = addObject(`<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`);
    const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  }

  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

function wrapLine(line: string, maxChars: number) {
  if (!line) return [""];
  const words = line.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) {
      current = word;
    } else if (`${current} ${word}`.length <= maxChars) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function tableLines(headers: string[], rows: string[][]) {
  if (rows.length === 0) return ["No records in this section."];
  const widths = headers.map((header, index) => {
    const maxCell = Math.max(header.length, ...rows.map((row) => String(row[index] || "").length));
    return Math.min(Math.max(maxCell, 8), index === 1 ? 28 : 18);
  });
  const render = (cells: string[]) => cells.map((cell, index) => truncate(String(cell || ""), widths[index]).padEnd(widths[index])).join("  ");
  return [render(headers), widths.map((width) => "-".repeat(width)).join("  "), ...rows.map(render)];
}

function truncate(value: string, width: number) {
  return value.length > width ? `${value.slice(0, Math.max(0, width - 1))}.` : value;
}

function escapePdfText(value: string) {
  return value.replace(/[^\x20-\x7E]/g, " ").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function resolveDateRange(query: URLSearchParams) {
  const from = query.get("from") || undefined;
  const to = query.get("to") || undefined;
  if (safeDateInput(from) && safeDateInput(to)) {
    return { from: from!, to: to!, start: startOfDay(from!), end: endExclusive(to!) };
  }
  const monthQuery = query.get("month") || undefined;
  const yearQuery = query.get("year") || undefined;
  const month = monthQuery?.includes("-") ? monthQuery : `${yearQuery || new Date().getFullYear()}-${monthQuery || String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const start = new Date(`${month}-01T00:00:00`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  return { from: month, to: month, start, end };
}

function productRows(orders: { id: string; items: { itemName: string; quantity: number; totalPrice: unknown }[] }[]): ProductRow[] {
  const map = new Map<string, { quantity: number; revenue: number; orderIds: Set<string> }>();
  for (const order of orders) {
    for (const item of order.items) {
      const current = map.get(item.itemName) || { quantity: 0, revenue: 0, orderIds: new Set<string>() };
      current.quantity += item.quantity;
      current.revenue += Number(item.totalPrice);
      current.orderIds.add(order.id);
      map.set(item.itemName, current);
    }
  }
  const totalRevenue = Array.from(map.values()).reduce((sum, item) => sum + item.revenue, 0);
  return Array.from(map.entries())
    .map(([itemName, value]) => ({
      itemName,
      quantity: value.quantity,
      revenue: value.revenue,
      orders: value.orderIds.size,
      share: totalRevenue > 0 ? (value.revenue / totalRevenue) * 100 : 0
    }))
    .sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity || a.itemName.localeCompare(b.itemName));
}

function groupTotals<T extends { total: unknown }>(items: T[], key: (item: T) => string) {
  const map = new Map<string, { orders: number; total: number }>();
  for (const item of items) {
    const label = key(item);
    const current = map.get(label) || { orders: 0, total: 0 };
    current.orders += 1;
    current.total += Number(item.total);
    map.set(label, current);
  }
  return Array.from(map.entries())
    .map(([label, value]) => ({ label, orders: value.orders, total: value.total }))
    .sort((a, b) => b.total - a.total);
}

function dailyRevenueRows(orders: { createdAt: Date; total: unknown }[]) {
  const map = new Map<string, { date: string; dayName: string; orders: number; total: number }>();
  for (const order of orders) {
    const date = reportDate(order.createdAt);
    const current = map.get(date) || { date, dayName: reportDayName(order.createdAt), orders: 0, total: 0 };
    current.orders += 1;
    current.total += Number(order.total);
    map.set(date, current);
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function safeDateInput(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : value;
}

function startOfDay(value: string) {
  return new Date(`${value}T00:00:00`);
}

function endExclusive(value: string) {
  return new Date(new Date(`${value}T00:00:00`).getTime() + dayMs);
}

function positiveInt(value?: string) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function enumValue<T extends Record<string, string>>(value: string | undefined, values: T) {
  return value && Object.values(values).includes(value) ? value as T[keyof T] : null;
}

function reportDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: reportTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value || "0000";
  const month = parts.find((part) => part.type === "month")?.value || "00";
  const day = parts.find((part) => part.type === "day")?.value || "00";
  return `${year}-${month}-${day}`;
}

function reportDayName(date: Date) {
  return new Intl.DateTimeFormat("en", { timeZone: reportTimeZone, weekday: "long" }).format(date);
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "restaurant";
}
