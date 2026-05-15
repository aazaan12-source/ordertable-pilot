import { getManagerRestaurant } from "@/lib/permissions";
import { db } from "@/lib/db";
import { formatCurrency, formatPkDateTime } from "@/lib/utils";
import { PrintControls } from "@/components/dashboard/print-controls";

export const dynamic = "force-dynamic";

export default async function MonthlyStatementPage({
  searchParams
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { restaurant } = await getManagerRestaurant();
  const { month = new Date().toISOString().slice(0, 7) } = await searchParams;
  const start = new Date(`${month}-01T00:00:00`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  const [orders, revenue, mostOrdered] = await Promise.all([
    db.order.findMany({
      where: { restaurantId: restaurant.id, createdAt: { gte: start, lt: end } },
      include: { table: true, items: true },
      orderBy: { createdAt: "asc" }
    }),
    db.order.aggregate({ where: { restaurantId: restaurant.id, status: "PAID", createdAt: { gte: start, lt: end } }, _sum: { total: true }, _avg: { total: true } }),
    db.orderItem.groupBy({
      by: ["itemName"],
      where: { order: { restaurantId: restaurant.id, status: { not: "CANCELLED" }, createdAt: { gte: start, lt: end } } },
      _sum: { quantity: true, totalPrice: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 15
    })
  ]);

  return (
    <main className="mx-auto max-w-4xl bg-white p-6 text-black print:max-w-none">
      <PrintControls />
      <section className="receipt">
        <div className="border-b pb-4">
          <p className="text-sm uppercase tracking-wide">Monthly Statement</p>
          <h1 className="text-3xl font-black">{restaurant.name}</h1>
          <p>{restaurant.branchName} · {restaurant.city}</p>
          <p className="text-sm">Month: {month} · Generated: {formatPkDateTime(new Date())}</p>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <Stat title="Orders" value={orders.length} />
          <Stat title="Paid revenue" value={formatCurrency(revenue._sum.total?.toString() || 0)} />
          <Stat title="Average paid order" value={formatCurrency(revenue._avg.total?.toString() || 0)} />
        </div>

        <h2 className="mt-8 text-xl font-black">Most ordered items</h2>
        <table className="mt-3 w-full border-collapse text-sm">
          <thead><tr><th className="border p-2 text-left">Item</th><th className="border p-2 text-right">Qty</th><th className="border p-2 text-right">Sales</th></tr></thead>
          <tbody>
            {mostOrdered.map((item) => (
              <tr key={item.itemName}>
                <td className="border p-2">{item.itemName}</td>
                <td className="border p-2 text-right">{item._sum.quantity || 0}</td>
                <td className="border p-2 text-right">{formatCurrency(item._sum.totalPrice?.toString() || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className="mt-8 text-xl font-black">Order history</h2>
        <table className="mt-3 w-full border-collapse text-xs">
          <thead><tr><th className="border p-2 text-left">Time</th><th className="border p-2 text-left">Order</th><th className="border p-2">Table</th><th className="border p-2">Status</th><th className="border p-2 text-right">Total</th></tr></thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td className="border p-2">{formatPkDateTime(order.createdAt)}</td>
                <td className="border p-2">{order.orderNumber}</td>
                <td className="border p-2 text-center">{order.table.tableNumber}</td>
                <td className="border p-2 text-center">{order.status}</td>
                <td className="border p-2 text-right">{formatCurrency(order.total.toString())}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-6 text-xs text-muted-foreground">Use the browser print dialog and choose Save as PDF to save this statement on your computer.</p>
      </section>
    </main>
  );
}

function Stat({ title, value }: { title: string; value: React.ReactNode }) {
  return (
    <div className="border p-3">
      <p className="text-xs uppercase tracking-wide">{title}</p>
      <p className="text-xl font-black">{value}</p>
    </div>
  );
}
