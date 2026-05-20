import { OrderSource, PaymentMethod, PaymentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getManagerRestaurant } from "@/lib/permissions";
import { orderSourceLabels } from "@/lib/order-utils";
import { PrintControls } from "@/components/dashboard/print-controls";
import { formatCurrency, formatPkDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PrintQuery = {
  month?: string;
  year?: string;
  from?: string;
  to?: string;
  tableNumber?: string;
  source?: string;
  paymentStatus?: string;
  paymentMethod?: string;
};

const dayMs = 24 * 60 * 60 * 1000;
const reportTimeZone = "Asia/Karachi";

export default async function MonthlyFinancialPrintPage({ searchParams }: { searchParams: Promise<PrintQuery> }) {
  const { restaurant } = await getManagerRestaurant();
  const query = await searchParams;
  const dateRange = resolveDateRange(query);
  const selectedTableNumber = positiveInt(query.tableNumber);
  const source = enumValue(query.source, OrderSource);
  const paymentStatus = enumValue(query.paymentStatus, PaymentStatus);
  const paymentMethod = enumValue(query.paymentMethod, PaymentMethod);

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

  return (
    <main className="mx-auto max-w-5xl bg-white p-6 text-black print:max-w-none">
      <PrintControls />
      <section>
        <div className="border-b pb-4">
          <p className="text-sm uppercase tracking-wide">Revenue and Product Performance Report</p>
          <h1 className="text-3xl font-black">{restaurant.name}</h1>
          <p>{restaurant.branchName} - {restaurant.city}</p>
          <p className="text-sm">Period: {dateRange.from} to {dateRange.to} - Generated: {formatPkDateTime(new Date())}</p>
          <p className="text-sm">
            Filters: {selectedTableNumber ? `Table ${selectedTableNumber}` : "All tables"}
            {source ? ` - ${orderSourceLabels[source] || source}` : " - All sources"}
            {paymentStatus ? ` - ${paymentStatus}` : " - All payment statuses"}
            {paymentMethod ? ` - ${paymentMethod}` : " - All payment methods"}
          </p>
        </div>

        <h2 className="mt-6 text-xl font-black">1. Revenue Summary</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat title="Total orders" value={orders.length} />
          <Stat title="Paid orders" value={paid.length} />
          <Stat title="Unpaid orders" value={orders.filter((order) => order.paymentStatus === "UNPAID").length} />
          <Stat title="Cancelled" value={orders.filter((order) => order.status === "CANCELLED").length} />
          <Stat title="Gross item sales" value={formatCurrency(grossSales)} />
          <Stat title="Discounts" value={formatCurrency(discounts)} />
          <Stat title="Service charges" value={formatCurrency(serviceCharges)} />
          <Stat title="Tax" value={formatCurrency(tax)} />
          <Stat title="Net paid revenue" value={formatCurrency(netSales)} />
          <Stat title="Average paid order" value={formatCurrency(averageOrder)} />
        </div>

        <h2 className="mt-8 text-xl font-black">2. Product Revenue Ranking</h2>
        <table className="mt-3 w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border p-2 text-left">Rank</th>
              <th className="border p-2 text-left">Menu item</th>
              <th className="border p-2 text-right">Qty</th>
              <th className="border p-2 text-right">Orders</th>
              <th className="border p-2 text-right">Revenue</th>
              <th className="border p-2 text-right">Share</th>
            </tr>
          </thead>
          <tbody>
            {itemRows.map((item, index) => (
              <tr key={item.itemName}>
                <td className="border p-2">{index + 1}</td>
                <td className="border p-2">{item.itemName}</td>
                <td className="border p-2 text-right">{item.quantity}</td>
                <td className="border p-2 text-right">{item.orders}</td>
                <td className="border p-2 text-right">{formatCurrency(item.revenue)}</td>
                <td className="border p-2 text-right">{item.share.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>

        <DailyRevenueTable title="3. Daily Revenue" rows={byDay} />
        <ReportTable title="4. Table Revenue" rows={byTable} />
        <ReportTable title="5. Revenue by Payment Method" rows={byPayment} />
        <ReportTable title="6. Revenue by Order Source" rows={bySource} />

        <h2 className="mt-8 text-xl font-black">7. Order History</h2>
        <table className="mt-3 w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="border p-2 text-left">Time</th>
              <th className="border p-2 text-left">Order</th>
              <th className="border p-2">Table</th>
              <th className="border p-2">Source</th>
              <th className="border p-2">Status</th>
              <th className="border p-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td className="border p-2">{formatPkDateTime(order.createdAt)}</td>
                <td className="border p-2">{order.orderNumber}</td>
                <td className="border p-2 text-center">{order.table.tableNumber}</td>
                <td className="border p-2 text-center">{orderSourceLabels[order.source] || order.source}</td>
                <td className="border p-2 text-center">{order.status}</td>
                <td className="border p-2 text-right">{formatCurrency(order.total.toString())}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-6 text-xs">Notes: Cancelled orders are listed for control but excluded from revenue and product-performance totals. Use the browser print dialog and choose Save as PDF to store this report locally.</p>
      </section>
    </main>
  );
}

function resolveDateRange(query: PrintQuery) {
  if (safeDateInput(query.from) && safeDateInput(query.to)) {
    return { from: query.from!, to: query.to!, start: startOfDay(query.from!), end: endExclusive(query.to!) };
  }
  const month = query.month?.includes("-") ? query.month : `${query.year || new Date().getFullYear()}-${query.month || String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const start = new Date(`${month}-01T00:00:00`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  return { from: month, to: month, start, end };
}

function productRows(orders: { id: string; items: { itemName: string; quantity: number; totalPrice: unknown }[] }[]) {
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

function DailyRevenueTable({ title, rows }: { title: string; rows: { date: string; dayName: string; orders: number; total: number }[] }) {
  return (
    <>
      <h2 className="mt-8 text-xl font-black">{title}</h2>
      <table className="mt-3 w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border p-2 text-left">Date</th>
            <th className="border p-2 text-left">Day</th>
            <th className="border p-2 text-right">Orders</th>
            <th className="border p-2 text-right">Revenue</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.date}>
              <td className="border p-2">{row.date}</td>
              <td className="border p-2">{row.dayName}</td>
              <td className="border p-2 text-right">{row.orders}</td>
              <td className="border p-2 text-right">{formatCurrency(row.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function ReportTable({ title, rows }: { title: string; rows: { label: string; orders: number; total: number }[] }) {
  return (
    <>
      <h2 className="mt-8 text-xl font-black">{title}</h2>
      <table className="mt-3 w-full border-collapse text-sm">
        <thead><tr><th className="border p-2 text-left">Label</th><th className="border p-2 text-right">Orders</th><th className="border p-2 text-right">Revenue</th></tr></thead>
        <tbody>
          {rows.map((row) => <tr key={row.label}><td className="border p-2">{row.label}</td><td className="border p-2 text-right">{row.orders}</td><td className="border p-2 text-right">{formatCurrency(row.total)}</td></tr>)}
        </tbody>
      </table>
    </>
  );
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

function Stat({ title, value }: { title: string; value: React.ReactNode }) {
  return <div className="border p-3"><p className="text-xs uppercase tracking-wide">{title}</p><p className="text-xl font-black">{value}</p></div>;
}
