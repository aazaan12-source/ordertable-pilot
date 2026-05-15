import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getManagerRestaurant } from "@/lib/permissions";
import { AutoPrint } from "@/components/dashboard/auto-print";
import { PrintControls } from "@/components/dashboard/print-controls";
import { formatCurrency, formatPkDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CustomerBillPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { restaurant } = await getManagerRestaurant();
  const { orderId } = await params;
  const order = await db.order.findFirst({
    where: { id: orderId, restaurantId: restaurant.id },
    include: { table: true, restaurant: true, items: true }
  });
  if (!order) notFound();

  return (
    <main className="print-page mx-auto max-w-[80mm] bg-white p-4 text-black">
      <AutoPrint orderId={order.id} type="BILL" />
      <PrintControls />
      <section className="receipt">
        <h1 className="text-center text-base font-black uppercase">{order.restaurant.name}</h1>
        <p className="text-center text-xs">{order.restaurant.branchName}</p>
        <p className="text-center text-xs">{order.restaurant.address}</p>
        <p className="text-center text-xs">Phone: {order.restaurant.phone}</p>
        <p className="mt-2 text-center text-sm font-bold">CUSTOMER BILL</p>
        <div className="my-2 border-t border-dashed border-black" />
        <Meta label="Order" value={order.orderNumber} />
        <Meta label="Table" value={String(order.table.tableNumber)} />
        <Meta label="Date" value={formatPkDateTime(order.createdAt)} />
        <div className="my-2 border-t border-dashed border-black" />
        <div className="space-y-3">
          {order.items.map((item) => (
            <div key={item.id}>
              <div className="flex justify-between gap-2 font-bold">
                <span>{item.quantity} x {item.itemName}</span>
                <span>{formatCurrency(item.totalPrice.toString())}</span>
              </div>
              <p className="text-xs">{formatCurrency(item.unitPrice.toString())} x {item.quantity}</p>
            </div>
          ))}
        </div>
        <div className="my-2 border-t border-dashed border-black" />
        <Meta label="Subtotal" value={formatCurrency(order.subtotal.toString())} />
        <Meta label="Service Charges" value={formatCurrency(order.serviceCharges.toString())} />
        <Meta label="Tax" value={formatCurrency(order.tax.toString())} />
        <Meta label="Discount" value={formatCurrency(order.discount.toString())} />
        <div className="my-2 border-t border-dashed border-black" />
        <div className="flex justify-between gap-2 text-base font-black">
          <span>Total</span>
          <span>{formatCurrency(order.total.toString())}</span>
        </div>
        <p className="mt-2 text-xs">Payment Status: {order.paymentStatus}</p>
        <p className="mt-4 text-center text-xs">Thank you for dining with us.</p>
      </section>
    </main>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 text-sm">
      <span className="font-bold">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
