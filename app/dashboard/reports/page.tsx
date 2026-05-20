import Link from "next/link";
import { OrderSource, PaymentMethod, PaymentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getManagerRestaurant } from "@/lib/permissions";
import { orderSourceLabels } from "@/lib/order-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatPkDateTime, formatPkTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

type ReportQuery = {
  from?: string;
  to?: string;
  tableNumber?: string;
  source?: string;
  paymentStatus?: string;
  paymentMethod?: string;
};

type ProductRow = {
  itemName: string;
  quantity: number;
  revenue: number;
  orders: number;
  share: number;
};

type DailyRevenueRow = {
  date: string;
  dayName: string;
  orders: number;
  total: number;
};

const dayMs = 24 * 60 * 60 * 1000;
const reportTimeZone = "Asia/Karachi";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<ReportQuery> }) {
  const { restaurant } = await getManagerRestaurant();
  const query = await searchParams;
  const today = new Date();
  const defaultTo = toDateInput(today);
  const defaultFrom = toDateInput(new Date(today.getTime() - 6 * dayMs));
  const from = safeDateInput(query.from) || defaultFrom;
  const to = safeDateInput(query.to) || defaultTo;
  const start = startOfDay(from);
  const end = endExclusive(to);
  const selectedTableNumber = positiveInt(query.tableNumber);
  const source = enumValue(query.source, OrderSource);
  const paymentStatus = enumValue(query.paymentStatus, PaymentStatus);
  const paymentMethod = enumValue(query.paymentMethod, PaymentMethod);

  const tables = await db.restaurantTable.findMany({
    where: { restaurantId: restaurant.id, status: { not: "INACTIVE" } },
    orderBy: { tableNumber: "asc" },
    select: { id: true, tableNumber: true }
  });
  const selectedTable = selectedTableNumber ? tables.find((table) => table.tableNumber === selectedTableNumber) : null;

  const reportWhere = {
    restaurantId: restaurant.id,
    createdAt: { gte: start, lt: end },
    ...(selectedTable ? { tableId: selectedTable.id } : {}),
    ...(source ? { source } : {}),
    ...(paymentStatus ? { paymentStatus } : {}),
    ...(paymentMethod ? { paymentMethod } : {})
  };

  const [orders, revenue, paidRevenue, history] = await Promise.all([
    db.order.findMany({
      where: reportWhere,
      include: { table: true, items: true },
      orderBy: { createdAt: "asc" }
    }),
    db.order.aggregate({
      where: { ...reportWhere, status: { not: "CANCELLED" } },
      _sum: { subtotal: true, discount: true, serviceCharges: true, tax: true, total: true },
      _avg: { total: true }
    }),
    db.order.aggregate({
      where: { ...reportWhere, status: { not: "CANCELLED" }, paymentStatus: "PAID" },
      _sum: { total: true },
      _avg: { total: true }
    }),
    db.order.findMany({
      where: reportWhere,
      include: { table: true },
      orderBy: { createdAt: "desc" },
      take: 40
    })
  ]);

  const nonCancelled = orders.filter((order) => order.status !== "CANCELLED");
  const paidOrders = orders.filter((order) => order.paymentStatus === "PAID");
  const unpaidOrders = orders.filter((order) => order.paymentStatus === "UNPAID");
  const productRows = buildProductRows(nonCancelled);
  const topProduct = productRows[0];
  const weakProducts = productRows.slice(-5).reverse();
  const tableRows = buildTableRows(nonCancelled);
  const dailyRevenueRows = buildDailyRevenueRows(nonCancelled);
  const printParams = new URLSearchParams({
    from,
    to,
    ...(selectedTableNumber ? { tableNumber: String(selectedTableNumber) } : {}),
    ...(source ? { source } : {}),
    ...(paymentStatus ? { paymentStatus } : {}),
    ...(paymentMethod ? { paymentMethod } : {})
  });

  return (
    <main className="p-4 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-sm text-muted-foreground">Choose dates, table, payment, or order source to understand sales and product performance.</p>
        </div>
        <Link href={`/dashboard/reports/monthly/print?${printParams.toString()}`} target="_blank">
          <Button>Print / Save PDF</Button>
        </Link>
      </div>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Generate Revenue Report</CardTitle>
          <p className="text-sm text-muted-foreground">Use calendar dates for daily, weekly, monthly, or custom-duration reports.</p>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <label className="text-sm font-semibold">
              From date
              <input type="date" name="from" defaultValue={from} className="mt-1 block h-10 w-full rounded-md border bg-white px-3 text-sm" />
            </label>
            <label className="text-sm font-semibold">
              To date
              <input type="date" name="to" defaultValue={to} className="mt-1 block h-10 w-full rounded-md border bg-white px-3 text-sm" />
            </label>
            <label className="text-sm font-semibold">
              Table
              <select name="tableNumber" defaultValue={selectedTableNumber ? String(selectedTableNumber) : ""} className="mt-1 block h-10 w-full rounded-md border bg-white px-3 text-sm">
                <option value="">All tables</option>
                {tables.map((table) => <option key={table.id} value={table.tableNumber}>Table {table.tableNumber}</option>)}
              </select>
            </label>
            <Select name="source" label="Source" value={source || ""} options={[["", "All"], ["ONLINE_QR", "Customer QR"], ["ONLINE_QR_CUSTOMER", "Customer QR New"], ["WAITER_ASSISTED_QR", "Waiter Assisted"], ["MANUAL_DASHBOARD", "Manual"], ["WAITER_ENTRY", "Waiter Entry"]]} />
            <Select name="paymentStatus" label="Payment" value={paymentStatus || ""} options={[["", "All"], ["UNPAID", "Unpaid"], ["PAID", "Paid"], ["PARTIAL", "Partial"], ["REFUNDED", "Refunded"]]} />
            <Select name="paymentMethod" label="Method" value={paymentMethod || ""} options={[["", "All"], ["CASH", "Cash"], ["CARD", "Card"], ["JAZZCASH", "JazzCash"], ["EASYPAISA", "EasyPaisa"], ["BANK_TRANSFER", "Bank Transfer"], ["OTHER", "Other"]]} />
            <Button className="md:col-span-3 xl:col-span-6">Generate Report</Button>
          </form>
        </CardContent>
      </Card>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat title="Report period" value={`${from} to ${to}`} />
        <Stat title="Orders" value={orders.length} />
        <Stat title="Paid orders" value={paidOrders.length} />
        <Stat title="Unpaid orders" value={unpaidOrders.length} />
        <Stat title="Gross item sales" value={formatCurrency(revenue._sum.subtotal?.toString() || 0)} />
        <Stat title="Discounts" value={formatCurrency(revenue._sum.discount?.toString() || 0)} />
        <Stat title="Net paid revenue" value={formatCurrency(paidRevenue._sum.total?.toString() || 0)} />
        <Stat title="Average paid order" value={formatCurrency(paidRevenue._avg.total?.toString() || 0)} />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <CardHeader>
            <CardTitle>Product Revenue Ranking</CardTitle>
            <p className="text-sm text-muted-foreground">Highest revenue menu items at the top. Low-revenue items appear at the bottom for review.</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3">Rank</th>
                    <th className="py-2 pr-3">Menu item</th>
                    <th className="py-2 pr-3 text-right">Qty sold</th>
                    <th className="py-2 pr-3 text-right">Orders</th>
                    <th className="py-2 pr-3 text-right">Revenue</th>
                    <th className="py-2 text-right">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {productRows.map((item, index) => (
                    <tr key={item.itemName} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-semibold">{index + 1}</td>
                      <td className="py-2 pr-3">{item.itemName}</td>
                      <td className="py-2 pr-3 text-right">{item.quantity}</td>
                      <td className="py-2 pr-3 text-right">{item.orders}</td>
                      <td className="py-2 pr-3 text-right font-semibold">{formatCurrency(item.revenue)}</td>
                      <td className="py-2 text-right">{item.share.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {productRows.length === 0 ? <p className="rounded-md border bg-white p-6 text-center text-muted-foreground">No products sold in this period.</p> : null}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle>Product Decision Guide</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {topProduct ? (
                <>
                  <p><strong>Best revenue item:</strong> {topProduct.itemName}</p>
                  <p><strong>Revenue:</strong> {formatCurrency(topProduct.revenue)} from {topProduct.quantity} sold.</p>
                  <p className="rounded-md bg-green-50 p-3 text-green-950">Keep promoting high-revenue items and make sure their stock stays available.</p>
                  {weakProducts.length > 0 ? (
                    <div className="rounded-md bg-orange-50 p-3 text-orange-950">
                      <p className="font-semibold">Review low-revenue items</p>
                      <p className="mt-1">{weakProducts.map((item) => item.itemName).join(", ")}</p>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-muted-foreground">Generate a report after orders are available to see product decisions.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Table Revenue</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {tableRows.map((row) => (
                <div key={row.label} className="flex justify-between gap-3 border-b pb-2 text-sm last:border-0">
                  <span>{row.label}</span>
                  <span className="font-semibold">{row.orders} orders - {formatCurrency(row.total)}</span>
                </div>
              ))}
              {tableRows.length === 0 ? <p className="text-sm text-muted-foreground">No table revenue in this period.</p> : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Daily Revenue</CardTitle>
          <p className="text-sm text-muted-foreground">Day name helps identify which weekdays are busiest for the restaurant.</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Day</th>
                  <th className="py-2 pr-3 text-right">Orders</th>
                  <th className="py-2 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {dailyRevenueRows.map((row) => (
                  <tr key={row.date} className="border-b last:border-0">
                    <td className="py-2 pr-3">{row.date}</td>
                    <td className="py-2 pr-3 font-semibold">{row.dayName}</td>
                    <td className="py-2 pr-3 text-right">{row.orders}</td>
                    <td className="py-2 text-right font-semibold">{formatCurrency(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {dailyRevenueRows.length === 0 ? <p className="rounded-md border bg-white p-6 text-center text-muted-foreground">No daily revenue in this period.</p> : null}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader><CardTitle>Recent Order History</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3">Time</th>
                  <th className="py-2 pr-3">Order</th>
                  <th className="py-2 pr-3">Table</th>
                  <th className="py-2 pr-3">Source</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {history.map((order) => (
                  <tr key={order.id} className="border-b last:border-0">
                    <td className="py-2 pr-3">{formatPkTime(order.createdAt)}</td>
                    <td className="py-2 pr-3">{order.orderNumber}</td>
                    <td className="py-2 pr-3">Table {order.table.tableNumber}</td>
                    <td className="py-2 pr-3">{orderSourceLabels[order.source] || order.source}</td>
                    <td className="py-2 pr-3">{order.status}</td>
                    <td className="py-2 text-right font-semibold">{formatCurrency(order.total.toString())}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {history.length === 0 ? <p className="rounded-md border bg-white p-6 text-center text-muted-foreground">No order history for this report filter.</p> : null}
        </CardContent>
      </Card>

      <p className="mt-5 text-xs text-muted-foreground">Generated {formatPkDateTime(new Date())}. Cancelled orders are shown in order history but excluded from product revenue and table revenue decisions.</p>
    </main>
  );
}

function buildProductRows(orders: { id: string; items: { itemName: string; quantity: number; totalPrice: unknown }[] }[]): ProductRow[] {
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

function buildTableRows(orders: { table: { tableNumber: number }; total: unknown }[]) {
  const map = new Map<string, { orders: number; total: number }>();
  for (const order of orders) {
    const label = `Table ${order.table.tableNumber}`;
    const current = map.get(label) || { orders: 0, total: 0 };
    current.orders += 1;
    current.total += Number(order.total);
    map.set(label, current);
  }
  return Array.from(map.entries())
    .map(([label, value]) => ({ label, orders: value.orders, total: value.total }))
    .sort((a, b) => b.total - a.total);
}

function buildDailyRevenueRows(orders: { createdAt: Date; total: unknown }[]): DailyRevenueRow[] {
  const map = new Map<string, DailyRevenueRow>();
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

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
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

function Select({ name, label, value, options }: { name: string; label: string; value: string; options: [string, string][] }) {
  return (
    <label className="text-sm font-semibold">
      {label}
      <select name={name} defaultValue={value} className="mt-1 block h-10 w-full rounded-md border bg-white px-3 text-sm">
        {options.map(([optionValue, labelText]) => <option key={optionValue || "all"} value={optionValue}>{labelText}</option>)}
      </select>
    </label>
  );
}

function Stat({ title, value }: { title: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm text-muted-foreground">{title}</CardTitle></CardHeader>
      <CardContent><p className="text-2xl font-bold">{value}</p></CardContent>
    </Card>
  );
}
