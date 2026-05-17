import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { updateDashboardOrder } from "@/lib/dashboard-order-actions";
import { getManagerRestaurant } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardOrderEditPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { restaurant } = await getManagerRestaurant();
  const { orderId } = await params;
  const order = await db.order.findFirst({
    where: { id: orderId, restaurantId: restaurant.id },
    include: { table: true, items: true }
  });
  if (!order) notFound();
  const categories = await db.category.findMany({
    where: { restaurantId: restaurant.id, isActive: true },
    include: { menuItems: { where: { isActive: true, isAvailable: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });

  if (order.status === "CANCELLED") {
    return (
      <main className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-2xl font-bold">Cancelled orders cannot be edited.</h1>
        <Link href={`/dashboard/orders/${order.id}`}><Button className="mt-4">Back to Order</Button></Link>
      </main>
    );
  }

  return (
    <main className="p-4 lg:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Edit Order/Bill</h1>
          <p className="text-sm text-muted-foreground">{order.orderNumber} · Table {order.table.tableNumber}</p>
        </div>
        <Link href={`/dashboard/orders/${order.id}`}><Button variant="outline">Back to Order</Button></Link>
      </div>
      {order.status === "PAID" ? <p className="mb-4 rounded-md border border-orange-300 bg-orange-50 p-3 text-sm text-orange-950">This order is already paid. Editing it will affect financial records and will be logged.</p> : null}

      <form action={updateDashboardOrder} className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <input type="hidden" name="orderId" value={order.id} />
        <div className="space-y-5">
          <Card id="add-items">
            <CardHeader><CardTitle>Existing items</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {order.items.map((item) => (
                <div key={item.id} className="grid gap-2 rounded-md border p-3 md:grid-cols-[1fr_90px_120px_1fr]">
                  <Input name={`existing_name_${item.id}`} defaultValue={item.itemName} />
                  <Input name={`existing_qty_${item.id}`} type="number" min={0} max={99} defaultValue={item.quantity} />
                  <Input name={`existing_price_${item.id}`} type="number" min={0} defaultValue={item.unitPrice.toString()} />
                  <Input name={`existing_note_${item.id}`} defaultValue={item.specialInstruction || ""} placeholder="Instruction" />
                  <p className="text-xs text-muted-foreground md:col-span-4">Set quantity to 0 to remove this item. Current line: {formatCurrency(item.totalPrice.toString())}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Add items during meal</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {categories.map((category) => (
                <div key={category.id}>
                  <h2 className="mb-2 font-bold">{category.name}</h2>
                  <div className="grid gap-2">
                    {category.menuItems.map((item) => (
                      <div key={item.id} className="grid gap-2 rounded-md border p-3 md:grid-cols-[1fr_90px_1fr]">
                        <div>
                          <p className="font-semibold">{item.name}</p>
                          <p className="text-sm text-muted-foreground">{formatCurrency(item.price.toString())}</p>
                        </div>
                        <Input name={`qty_${item.id}`} type="number" min={0} max={99} placeholder="Qty" />
                        <Input name={`note_${item.id}`} placeholder="Instruction optional" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <Card>
            <CardHeader><CardTitle>Order details</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input name="customerName" placeholder="Customer name" defaultValue={order.customerName || ""} />
              <Input name="customerPhone" placeholder="Customer phone" defaultValue={order.customerPhone || ""} />
              <Input name="waiterName" placeholder="Waiter name" defaultValue={order.waiterName || ""} />
              <Textarea name="specialNote" placeholder="Overall order note" defaultValue={order.specialNote || ""} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Custom item</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input name="customItemName" placeholder="Custom item name" />
              <div className="grid grid-cols-2 gap-3">
                <Input name="customQuantity" type="number" min={0} placeholder="Qty" />
                <Input name="customUnitPrice" type="number" min={0} placeholder="Unit price" />
              </div>
              <Input name="customInstruction" placeholder="Custom item instruction" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Bill and payment</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input name="discount" type="number" min={0} defaultValue={order.discount.toString()} placeholder="Discount" />
              <Input name="serviceChargePercent" type="number" min={0} defaultValue={restaurant.serviceChargePercent.toString()} placeholder="Service charge %" />
              <Input name="taxPercent" type="number" min={0} defaultValue={restaurant.taxPercent.toString()} placeholder="Tax %" />
              <select name="paymentStatus" defaultValue={order.paymentStatus} className="h-10 w-full rounded-md border bg-white px-3 text-sm">
                <option value="UNPAID">Unpaid</option>
                <option value="PAID">Paid</option>
                <option value="PARTIAL">Partial</option>
                <option value="REFUNDED">Refunded</option>
              </select>
              <select name="paymentMethod" defaultValue={order.paymentMethod || ""} className="h-10 w-full rounded-md border bg-white px-3 text-sm">
                <option value="">No method</option>
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="JAZZCASH">JazzCash</option>
                <option value="EASYPAISA">EasyPaisa</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="OTHER">Other</option>
              </select>
              <Button className="w-full" size="lg">Save Changes</Button>
            </CardContent>
          </Card>
        </aside>
      </form>
    </main>
  );
}
