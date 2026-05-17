import { db } from "@/lib/db";
import { createManualOrder } from "@/lib/dashboard-order-actions";
import { getManagerRestaurant } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function NewManualOrderPage() {
  const { restaurant } = await getManagerRestaurant();
  const [tables, categories] = await Promise.all([
    db.restaurantTable.findMany({ where: { restaurantId: restaurant.id, status: { not: "INACTIVE" } }, orderBy: { tableNumber: "asc" } }),
    db.category.findMany({
      where: { restaurantId: restaurant.id, isActive: true },
      include: { menuItems: { where: { isActive: true, isAvailable: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    })
  ]);

  return (
    <main className="p-4 lg:p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Create Manual Order</h1>
        <p className="text-sm text-muted-foreground">Use this when a waiter or cashier takes an order verbally. It will appear in live orders and reports.</p>
      </div>
      <form action={createManualOrder} className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle>Table and customer details</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <select name="tableNumber" className="h-10 rounded-md border bg-white px-3 text-sm" required>
                {tables.map((table) => <option key={table.id} value={table.tableNumber}>Table {table.tableNumber}</option>)}
              </select>
              <select name="source" className="h-10 rounded-md border bg-white px-3 text-sm">
                <option value="MANUAL_DASHBOARD">Manual Dashboard</option>
                <option value="WAITER_ENTRY">Waiter Entry</option>
              </select>
              <Input name="waiterName" placeholder="Waiter name optional" />
              <Input name="customerName" placeholder="Customer name optional" />
              <Input name="customerPhone" placeholder="Customer phone optional" />
              <select name="paymentMethod" className="h-10 rounded-md border bg-white px-3 text-sm" defaultValue="">
                <option value="">Payment method later</option>
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="JAZZCASH">JazzCash</option>
                <option value="EASYPAISA">EasyPaisa</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="OTHER">Other</option>
              </select>
              <Textarea className="md:col-span-3" name="specialNote" placeholder="Overall order note" />
            </CardContent>
          </Card>

          {categories.map((category) => (
            <Card key={category.id}>
              <CardHeader><CardTitle>{category.name}</CardTitle></CardHeader>
              <CardContent className="grid gap-3">
                {category.menuItems.map((item) => (
                  <div key={item.id} className="grid gap-2 rounded-md border p-3 md:grid-cols-[1fr_90px_1.2fr]">
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-sm text-muted-foreground">{formatCurrency(item.price.toString())}</p>
                    </div>
                    <Input name={`qty_${item.id}`} type="number" min={0} max={99} placeholder="Qty" />
                    <Input name={`note_${item.id}`} placeholder="Instruction optional" />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>

        <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
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
            <CardHeader><CardTitle>Bill adjustment</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input name="discount" type="number" min={0} defaultValue={0} placeholder="Discount" />
              <p className="text-xs text-muted-foreground">Service charges and tax use restaurant settings. Backend recalculates trusted totals after submit.</p>
              <Button className="w-full" size="lg">Send to Kitchen</Button>
            </CardContent>
          </Card>
        </aside>
      </form>
    </main>
  );
}
