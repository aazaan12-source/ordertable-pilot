import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getManagerRestaurant } from "@/lib/permissions";
import { AutoPrint } from "@/components/dashboard/auto-print";
import { PrintControls } from "@/components/dashboard/print-controls";
import { formatPkDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function KitchenSlipPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { restaurant } = await getManagerRestaurant();
  const { orderId } = await params;
  const order = await db.order.findFirst({
    where: { id: orderId, restaurantId: restaurant.id },
    include: { table: true, restaurant: true, items: true }
  });
  if (!order) notFound();

  return (
    <main className="print-page mx-auto max-w-[80mm] bg-white p-4 text-black">
      <AutoPrint orderId={order.id} type="KITCHEN" />
      <PrintControls />
      <section className="receipt">
        <h1 className="text-center text-base font-black uppercase">{order.restaurant.name}</h1>
        <p className="text-center text-sm font-bold">KITCHEN ORDER SLIP</p>
        <div className="my-2 border-t border-dashed border-black" />
        <Meta label="Order" value={order.orderNumber} />
        <Meta label="Table" value={String(order.table.tableNumber)} />
        <Meta label="Time" value={formatPkDateTime(order.createdAt)} />
        <Meta label="Status" value={order.status.replaceAll("_", " ")} />
        <div className="my-2 border-t border-dashed border-black" />
        <div className="space-y-3">
          {order.items.map((item) => (
            <div key={item.id}>
              <p className="font-bold">{item.quantity} x {item.itemName}</p>
              {item.specialInstruction ? <p className="whitespace-pre-wrap text-xs">Note: {item.specialInstruction}</p> : null}
            </div>
          ))}
        </div>
        {order.specialNote ? (
          <>
            <div className="my-2 border-t border-dashed border-black" />
            <p className="font-bold">Order Note:</p>
            <p className="whitespace-pre-wrap text-xs">{order.specialNote}</p>
          </>
        ) : null}
        <div className="my-2 border-t border-dashed border-black" />
        <p className="text-center text-xs">Printed: {formatPkDateTime(new Date())}</p>
      </section>
    </main>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 text-sm">
      <span className="font-bold">{label}</span>
      <span>{value}</span>
    </div>
  );
}
