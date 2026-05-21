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

  const filters = [
    selectedTableNumber ? `Table ${selectedTableNumber}` : "All tables",
    source ? orderSourceLabels[source] || source : "All sources",
    paymentStatus || "All payment statuses",
    paymentMethod || "All payment methods"
  ].join(" - ");

  const pdf = createFormattedReportPdf({
    restaurantName: restaurant.name,
    restaurantLocation: `${restaurant.branchName || ""}${restaurant.branchName && restaurant.city ? " - " : ""}${restaurant.city || ""}`,
    period: `${dateRange.from} to ${dateRange.to}`,
    generatedAt: formatPkDateTime(new Date()),
    filters,
    summary: [
      ["Total orders", String(orders.length)],
      ["Paid orders", String(paid.length)],
      ["Unpaid orders", String(orders.filter((order) => order.paymentStatus === "UNPAID").length)],
      ["Cancelled", String(orders.filter((order) => order.status === "CANCELLED").length)],
      ["Gross item sales", formatCurrency(grossSales)],
      ["Discounts", formatCurrency(discounts)],
      ["Service charges", formatCurrency(serviceCharges)],
      ["Tax", formatCurrency(tax)],
      ["Net paid revenue", formatCurrency(netSales)],
      ["Average paid order", formatCurrency(averageOrder)]
    ],
    productRows: itemRows.map((item, index) => [
      String(index + 1),
      item.itemName,
      String(item.quantity),
      String(item.orders),
      formatCurrency(item.revenue),
      `${item.share.toFixed(1)}%`
    ]),
    dailyRows: byDay.map((row) => [row.date, row.dayName, String(row.orders), formatCurrency(row.total)]),
    tableRows: byTable.map((row) => [row.label, String(row.orders), formatCurrency(row.total)]),
    paymentRows: byPayment.map((row) => [row.label, String(row.orders), formatCurrency(row.total)]),
    sourceRows: bySource.map((row) => [row.label, String(row.orders), formatCurrency(row.total)]),
    orderRows: orders.map((order) => [
      formatPkDateTime(order.createdAt),
      order.orderNumber,
      String(order.table.tableNumber),
      orderSourceLabels[order.source] || order.source,
      order.status,
      formatCurrency(order.total.toString())
    ])
  });
  const filename = `${slugify(restaurant.name)}-report-${dateRange.from}-to-${dateRange.to}.pdf`;
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store, max-age=0"
    }
  });
}

function createFormattedReportPdf(report: {
  restaurantName: string;
  restaurantLocation: string;
  period: string;
  generatedAt: string;
  filters: string;
  summary: string[][];
  productRows: string[][];
  dailyRows: string[][];
  tableRows: string[][];
  paymentRows: string[][];
  sourceRows: string[][];
  orderRows: string[][];
}) {
  const pdf = new PdfDocument();
  pdf.header(report.restaurantName, report.restaurantLocation, report.period, report.generatedAt, report.filters);
  pdf.section("1. Revenue Summary");
  pdf.summaryGrid(report.summary);
  pdf.table("2. Product Revenue Ranking", ["Rank", "Menu item", "Qty", "Orders", "Revenue", "Share"], report.productRows, [34, 210, 48, 55, 96, 60]);
  pdf.table("3. Daily Revenue", ["Date", "Day", "Orders", "Revenue"], report.dailyRows, [105, 155, 80, 145]);
  pdf.table("4. Table Revenue", ["Table", "Orders", "Revenue"], report.tableRows, [190, 100, 160]);
  pdf.table("5. Revenue by Payment Method", ["Method", "Orders", "Revenue"], report.paymentRows, [190, 100, 160]);
  pdf.table("6. Revenue by Order Source", ["Source", "Orders", "Revenue"], report.sourceRows, [190, 100, 160]);
  pdf.table("7. Order History", ["Time", "Order", "Table", "Source", "Status", "Total"], report.orderRows, [94, 132, 44, 82, 70, 75], 8);
  pdf.note("Notes: Cancelled orders are listed for control but excluded from revenue and product-performance totals.");
  return pdf.render();
}

class PdfDocument {
  private readonly pageWidth = 595;
  private readonly pageHeight = 842;
  private readonly margin = 36;
  private readonly bottom = 36;
  private y = 806;
  private pages: string[][] = [];

  constructor() {
    this.addPage();
  }

  header(restaurantName: string, restaurantLocation: string, period: string, generatedAt: string, filters: string) {
    this.fillRect(this.margin, this.y, 523, 74, "0.93 0.98 0.96");
    this.strokeRect(this.margin, this.y, 523, 74, "0.75 0.85 0.80");
    this.text(this.margin + 14, this.y - 22, "Revenue and Product Performance Report", 10, "bold", "0.10 0.45 0.32");
    this.text(this.margin + 14, this.y - 42, restaurantName, 20, "bold");
    this.text(this.margin + 14, this.y - 58, restaurantLocation || "Restaurant", 9);
    this.text(this.margin + 318, this.y - 26, `Period: ${period}`, 9, "bold");
    this.text(this.margin + 318, this.y - 42, `Generated: ${generatedAt}`, 8);
    this.text(this.margin + 318, this.y - 58, truncate(filters, 40), 8);
    this.y -= 94;
  }

  section(title: string) {
    const topGap = this.y < 790 ? 12 : 0;
    this.ensure(46 + topGap);
    if (topGap) this.y -= topGap;
    this.text(this.margin, this.y, title, 13, "bold", "0.08 0.22 0.18");
    this.line(this.margin, this.y - 8, this.margin + 523, this.y - 8, "0.75 0.85 0.80");
    this.y -= 28;
  }

  summaryGrid(rows: string[][]) {
    const columns = 2;
    const boxWidth = 255;
    const boxHeight = 34;
    for (let index = 0; index < rows.length; index += columns) {
      this.ensure(boxHeight + 8);
      for (let column = 0; column < columns; column += 1) {
        const row = rows[index + column];
        if (!row) continue;
        const x = this.margin + column * (boxWidth + 13);
        this.fillRect(x, this.y, boxWidth, boxHeight, "0.98 0.98 0.97");
        this.strokeRect(x, this.y, boxWidth, boxHeight, "0.82 0.82 0.80");
        this.text(x + 10, this.y - 13, row[0], 8, "regular", "0.35 0.35 0.35");
        this.text(x + 10, this.y - 27, row[1], 11, "bold");
      }
      this.y -= boxHeight + 8;
    }
    this.y -= 8;
  }

  table(title: string, headers: string[], rows: string[][], widths: number[], fontSize = 8.5) {
    const rowHeight = 19;
    this.tableSection(title, rowHeight * 3);
    if (rows.length === 0) {
      this.ensure(28);
      this.text(this.margin + 8, this.y - 12, "No records in this section.", 9);
      this.y -= 28;
      return;
    }

    this.drawTableHeader(headers, widths, rowHeight, fontSize);
    for (const row of rows) {
      if (this.ensure(rowHeight)) {
        this.drawTableHeader(headers, widths, rowHeight, fontSize);
      }
      this.drawTableRow(row, widths, rowHeight, fontSize);
    }
    this.y -= 18;
  }

  note(text: string) {
    this.ensure(28);
    this.text(this.margin, this.y, text, 8);
    this.y -= 16;
  }

  render() {
    const objects: string[] = [];
    const addObject = (body: string) => {
      objects.push(body);
      return objects.length;
    };
    const catalogId = addObject("<< /Type /Catalog /Pages 2 0 R >>");
    const pagesId = addObject("");
    const regularFontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    const boldFontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
    const pageIds: number[] = [];

    for (const commands of this.pages) {
      const content = commands.join("\n");
      const contentId = addObject(`<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`);
      const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${this.pageWidth} ${this.pageHeight}] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
      pageIds.push(pageId);
    }

    objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
    let output = "%PDF-1.4\n";
    const offsets = [0];
    objects.forEach((body, index) => {
      offsets.push(Buffer.byteLength(output, "latin1"));
      output += `${index + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xrefOffset = Buffer.byteLength(output, "latin1");
    output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let index = 1; index <= objects.length; index += 1) {
      output += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
    }
    output += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return Buffer.from(output, "latin1");
  }

  private drawTableHeader(headers: string[], widths: number[], rowHeight: number, fontSize: number) {
    this.ensure(rowHeight);
    this.fillRect(this.margin, this.y, sum(widths), rowHeight, "0.90 0.94 0.92");
    this.drawTableCells(headers, widths, rowHeight, fontSize, true);
  }

  private tableSection(title: string, nextContentHeight: number) {
    const topGap = this.y < 790 ? 16 : 0;
    this.ensure(32 + nextContentHeight + topGap);
    if (topGap) this.y -= topGap;
    this.text(this.margin, this.y, title, 13, "bold", "0.08 0.22 0.18");
    this.line(this.margin, this.y - 8, this.margin + 523, this.y - 8, "0.75 0.85 0.80");
    this.y -= 30;
  }

  private drawTableRow(row: string[], widths: number[], rowHeight: number, fontSize: number) {
    this.drawTableCells(row, widths, rowHeight, fontSize, false);
  }

  private drawTableCells(cells: string[], widths: number[], rowHeight: number, fontSize: number, header: boolean) {
    let x = this.margin;
    for (let index = 0; index < widths.length; index += 1) {
      const width = widths[index];
      this.strokeRect(x, this.y, width, rowHeight, "0.72 0.72 0.70");
      const value = truncate(String(cells[index] || ""), Math.max(6, Math.floor(width / (fontSize * 0.55))));
      const alignRight = index >= 2 && !header;
      const textX = alignRight ? x + width - 5 - estimateTextWidth(value, fontSize) : x + 5;
      this.text(Math.max(x + 4, textX), this.y - 12, value, fontSize, header ? "bold" : "regular");
      x += width;
    }
    this.y -= rowHeight;
  }

  private ensure(height: number) {
    if (this.y - height < this.bottom) {
      this.addPage();
      return true;
    }
    return false;
  }

  private addPage() {
    this.pages.push([]);
    this.y = 806;
  }

  private command(value: string) {
    this.pages[this.pages.length - 1].push(value);
  }

  private text(x: number, y: number, value: string, size = 9, weight: "regular" | "bold" = "regular", color = "0 0 0") {
    const font = weight === "bold" ? "F2" : "F1";
    this.command(`q ${color} rg BT /${font} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${escapePdfText(value)}) Tj ET Q`);
  }

  private line(x1: number, y1: number, x2: number, y2: number, color = "0 0 0") {
    this.command(`q ${color} RG 0.7 w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S Q`);
  }

  private fillRect(x: number, topY: number, width: number, height: number, color: string) {
    this.command(`q ${color} rg ${x.toFixed(2)} ${(topY - height).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f Q`);
  }

  private strokeRect(x: number, topY: number, width: number, height: number, color: string) {
    this.command(`q ${color} RG 0.7 w ${x.toFixed(2)} ${(topY - height).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re S Q`);
  }
}

function truncate(value: string, width: number) {
  return value.length > width ? `${value.slice(0, Math.max(0, width - 1))}.` : value;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function estimateTextWidth(value: string, size: number) {
  return value.length * size * 0.52;
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
