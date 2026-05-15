import { db } from "@/lib/db";
import { getManagerRestaurant } from "@/lib/permissions";
import { orderSourceLabels } from "@/lib/order-utils";
import { PrintControls } from "@/components/dashboard/print-controls";
import { formatCurrency, formatPkDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MonthlyFinancialPrintPage({
  searchParams
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const { restaurant } = await getManagerRestaurant();
  const query = await searchParams;
  const month = query.month?.includes("-") ? query.month : `${query.year || new Date().getFullYear()}-${query.month || String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const start = new Date(`${month}-01T00:00:00`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  const orders = await db.order.findMany({
    where: { restaurantId: restaurant.id, createdAt: { gte: start, lt: end } },
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

  const byPayment = groupTotals(paid, (order) => order.paymentMethod || "UNSELECTED");
  const bySource = groupTotals(nonCancelled, (order) => order.source);
  const byTable = groupTotals(nonCancelled, (order) => `Table ${order.table.tableNumber}`);
  const byDay = groupTotals(nonCancelled, (order) => order.createdAt.toISOString().slice(0, 10));
  const itemTotals = new Map<string, { qty: number; sales: number }>();
  for (const order of nonCancelled) {
    for (const item of order.items) {
      const current = itemTotals.get(item.itemName) || { qty: 0, sales: 0 };
      current.qty += item.quantity;
      current.sales += Number(item.totalPrice);
      itemTotals.set(item.itemName, current);
    }
  }
  const topItems = Array.from(itemTotals.entries()).sort((a, b) => b[1].qty - a[1].qty).slice(0, 15);

  return (
    <main className="mx-auto max-w-5xl bg-white p-6 text-black print:max-w-none">
      <PrintControls />
      <section>
        <div className="border-b pb-4">
          <p className="text-sm uppercase tracking-wide">Monthly Financial Statement</p>
          <h1 className="text-3xl font-black">{restaurant.name}</h1>
          <p>{restaurant.branchName} · {restaurant.city}</p>
          <p className="text-sm">Month: {month} · Generated: {formatPkDateTime(new Date())}</p>
        </div>

        <h2 className="mt-6 text-xl font-black">1. Summary</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat title="Total orders" value={orders.length} />
          <Stat title="Paid orders" value={paid.length} />
          <Stat title="Unpaid orders" value={orders.filter((order) => order.paymentStatus === "UNPAID").length} />
          <Stat title="Cancelled" value={orders.filter((order) => order.status === "CANCELLED").length} />
          <Stat title="Gross sales" value={formatCurrency(grossSales)} />
          <Stat title="Discounts" value={formatCurrency(discounts)} />
          <Stat title="Service charges" value={formatCurrency(serviceCharges)} />
          <Stat title="Tax" value={formatCurrency(tax)} />
          <Stat title="Net sales" value={formatCurrency(netSales)} />
          <Stat title="Average paid order" value={formatCurrency(averageOrder)} />
        </div>

        <ReportTable title="2. Sales by Payment Method" rows={byPayment} />
        <ReportTable title="3. Sales by Order Source" rows={bySource.map((row) => ({ ...row, label: orderSourceLabels[row.label as keyof typeof orderSourceLabels] || row.label }))} />

        <h2 className="mt-8 text-xl font-black">4. Top Selling Items</h2>
        <table className="mt-3 w-full border-collapse text-sm">
          <thead><tr><th className="border p-2 text-left">Item</th><th className="border p-2 text-right">Qty</th><th className="border p-2 text-right">Sales</th></tr></thead>
          <tbody>
            {topItems.map(([name, value]) => (
              <tr key={name}><td className="border p-2">{name}</td><td className="border p-2 text-right">{value.qty}</td><td className="border p-2 text-right">{formatCurrency(value.sales)}</td></tr>
            ))}
          </tbody>
        </table>

        <ReportTable title="5. Daily Sales Breakdown" rows={byDay} />
        <ReportTable title="6. Table-wise Sales" rows={byTable} />

        <p className="mt-6 text-xs">Notes: This report is generated from OrderTable platform records. Cancelled orders are counted but excluded from revenue totals.</p>
      </section>
    </main>
  );
}

function groupTotals<T>(items: T[], key: (item: T) => string) {
  const map = new Map<string, { orders: number; total: number }>();
  for (const item of items as any[]) {
    const label = key(item);
    const current = map.get(label) || { orders: 0, total: 0 };
    current.orders += 1;
    current.total += Number(item.total);
    map.set(label, current);
  }
  return Array.from(map.entries()).map(([label, value]) => ({ label, orders: value.orders, total: value.total }));
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

function Stat({ title, value }: { title: string; value: React.ReactNode }) {
  return <div className="border p-3"><p className="text-xs uppercase tracking-wide">{title}</p><p className="text-xl font-black">{value}</p></div>;
}
