import Link from "next/link";
import { revalidatePath } from "next/cache";
import { InvoiceStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatPkDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function createInvoice(formData: FormData) {
  "use server";
  const user = await requirePlatformAdmin();
  const restaurantId = String(formData.get("restaurantId"));
  const billingMonth = String(formData.get("billingMonth") || new Date().toISOString().slice(0, 7));
  const amount = Number(formData.get("amount") || 0);
  await db.billingInvoice.create({
    data: {
      restaurantId,
      billingMonth,
      amount,
      planName: String(formData.get("planName") || "Pilot"),
      status: String(formData.get("status") || "DUE") as InvoiceStatus,
      dueDate: formData.get("dueDate") ? new Date(String(formData.get("dueDate"))) : null,
      notes: String(formData.get("notes") || "") || null
    }
  });
  await db.activityLog.create({ data: { userId: user.id, restaurantId, action: "BILLING_INVOICE_CREATED", description: `${billingMonth} invoice created` } });
  revalidatePath("/admin/billing");
}

async function updateInvoiceStatus(formData: FormData) {
  "use server";
  const user = await requirePlatformAdmin();
  const id = String(formData.get("id"));
  const status = String(formData.get("status")) as InvoiceStatus;
  const invoice = await db.billingInvoice.update({
    where: { id },
    data: {
      status,
      paidAt: status === "PAID" ? new Date() : null,
      paymentReference: String(formData.get("paymentReference") || "") || null
    }
  });
  await db.activityLog.create({ data: { userId: user.id, restaurantId: invoice.restaurantId, action: "BILLING_INVOICE_UPDATED", description: `${invoice.billingMonth} invoice changed to ${status}` } });
  revalidatePath("/admin/billing");
}

export default async function AdminBillingPage() {
  await requirePlatformAdmin();
  const [restaurants, invoices, paid, open] = await Promise.all([
    db.restaurant.findMany({ orderBy: { name: "asc" } }),
    db.billingInvoice.findMany({ include: { restaurant: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.billingInvoice.aggregate({ where: { status: "PAID" }, _sum: { amount: true } }),
    db.billingInvoice.aggregate({ where: { status: { in: ["DUE", "OVERDUE"] } }, _sum: { amount: true } })
  ]);

  return (
    <main className="mx-auto max-w-6xl p-4 lg:p-6">
      <h1 className="text-2xl font-bold">Platform Billing</h1>
      <p className="text-sm text-muted-foreground">Track monthly platform charges and whether restaurants have paid.</p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Paid invoices</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{formatCurrency(paid._sum.amount?.toString() || 0)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Due / overdue</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{formatCurrency(open._sum.amount?.toString() || 0)}</p></CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>Create Monthly Invoice</CardTitle></CardHeader>
        <CardContent>
          <form action={createInvoice} className="grid gap-3 md:grid-cols-3">
            <select name="restaurantId" className="h-10 rounded-md border bg-white px-3 text-sm" required>
              {restaurants.map((restaurant) => <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>)}
            </select>
            <Input name="billingMonth" type="month" defaultValue={new Date().toISOString().slice(0, 7)} />
            <Input name="amount" type="number" placeholder="Amount" defaultValue={0} />
            <select name="planName" className="h-10 rounded-md border bg-white px-3 text-sm" defaultValue="Pilot">
              <option value="Pilot">Pilot</option>
              <option value="Starter">Starter</option>
              <option value="Growth">Growth</option>
              <option value="Pro">Pro</option>
            </select>
            <select name="status" className="h-10 rounded-md border bg-white px-3 text-sm" defaultValue="DUE">
              <option value="DRAFT">DRAFT</option>
              <option value="DUE">DUE</option>
              <option value="PAID">PAID</option>
              <option value="OVERDUE">OVERDUE</option>
              <option value="WAIVED">WAIVED</option>
            </select>
            <Input name="dueDate" type="date" />
            <Textarea className="md:col-span-3" name="notes" placeholder="Billing notes" />
            <Button className="md:col-span-3">Create Invoice</Button>
          </form>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-4">
        {invoices.map((invoice) => (
          <Card key={invoice.id}>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold">{invoice.restaurant.name} · {invoice.billingMonth}</p>
                  <p className="text-sm text-muted-foreground">{invoice.planName} · {formatCurrency(invoice.amount.toString())} · {invoice.status}</p>
                  <p className="text-xs text-muted-foreground">Created {formatPkDateTime(invoice.createdAt)}</p>
                </div>
                <Link href={`/admin/restaurants/${invoice.restaurantId}`}><Button variant="outline">Restaurant</Button></Link>
              </div>
              <form action={updateInvoiceStatus} className="mt-3 flex flex-wrap gap-2">
                <input type="hidden" name="id" value={invoice.id} />
                <select name="status" defaultValue={invoice.status} className="h-10 rounded-md border bg-white px-3 text-sm">
                  <option value="DRAFT">DRAFT</option>
                  <option value="DUE">DUE</option>
                  <option value="PAID">PAID</option>
                  <option value="OVERDUE">OVERDUE</option>
                  <option value="WAIVED">WAIVED</option>
                </select>
                <Input name="paymentReference" placeholder="Payment reference" defaultValue={invoice.paymentReference || ""} />
                <Button>Save</Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
