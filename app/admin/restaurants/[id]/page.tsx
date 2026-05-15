import bcrypt from "bcryptjs";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { InvoiceStatus, SubscriptionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatPkDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function updateRestaurant(formData: FormData) {
  "use server";
  const user = await requirePlatformAdmin();
  const id = String(formData.get("id"));
  await db.restaurant.update({
    where: { id },
    data: {
      name: String(formData.get("name") || ""),
      branchName: String(formData.get("branchName") || ""),
      city: String(formData.get("city") || ""),
      address: String(formData.get("address") || ""),
      phone: String(formData.get("phone") || ""),
      status: formData.get("status") === "INACTIVE" ? "INACTIVE" : "ACTIVE",
      subscriptionStatus: String(formData.get("subscriptionStatus") || "PILOT") as SubscriptionStatus,
      orderingEnabled: formData.get("orderingEnabled") === "on",
      serviceChargePercent: Number(formData.get("serviceChargePercent") || 0),
      taxPercent: Number(formData.get("taxPercent") || 0),
      customerCancelWindowMinutes: Number(formData.get("customerCancelWindowMinutes") || 3),
      pilotEndDate: formData.get("pilotEndDate") ? new Date(String(formData.get("pilotEndDate"))) : null
    }
  });
  await db.activityLog.create({ data: { userId: user.id, restaurantId: id, action: "RESTAURANT_UPDATED", description: "Super admin updated restaurant" } });
  revalidatePath(`/admin/restaurants/${id}`);
}

async function createManager(formData: FormData) {
  "use server";
  const user = await requirePlatformAdmin();
  const restaurantId = String(formData.get("restaurantId"));
  const email = String(formData.get("email") || "").toLowerCase().trim();
  await db.user.create({
    data: {
      name: String(formData.get("name") || "Restaurant Manager"),
      email,
      passwordHash: await bcrypt.hash(String(formData.get("password") || "Manager12345"), 12),
      role: "RESTAURANT_MANAGER",
      restaurantId
    }
  });
  await db.activityLog.create({ data: { userId: user.id, restaurantId, action: "MANAGER_ACCOUNT_CREATED", description: email } });
  redirect(`/admin/restaurants/${restaurantId}`);
}

async function resetManagerPassword(formData: FormData) {
  "use server";
  const admin = await requirePlatformAdmin();
  const userId = String(formData.get("userId"));
  const restaurantId = String(formData.get("restaurantId"));
  const password = String(formData.get("password") || "Manager12345");
  const manager = await db.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(password, 12), isActive: true }
  });
  await db.activityLog.create({ data: { userId: admin.id, restaurantId, action: "MANAGER_PASSWORD_RESET", description: `Password reset for ${manager.email}` } });
  revalidatePath(`/admin/restaurants/${restaurantId}`);
}

async function toggleManagerStatus(formData: FormData) {
  "use server";
  const admin = await requirePlatformAdmin();
  const userId = String(formData.get("userId"));
  const restaurantId = String(formData.get("restaurantId"));
  const nextActive = formData.get("nextActive") === "true";
  const manager = await db.user.update({ where: { id: userId }, data: { isActive: nextActive } });
  await db.activityLog.create({ data: { userId: admin.id, restaurantId, action: "MANAGER_ACCESS_UPDATED", description: `${manager.email} active=${nextActive}` } });
  revalidatePath(`/admin/restaurants/${restaurantId}`);
}

async function createInvoice(formData: FormData) {
  "use server";
  const admin = await requirePlatformAdmin();
  const restaurantId = String(formData.get("restaurantId"));
  const status = String(formData.get("status") || "DUE") as InvoiceStatus;
  await db.billingInvoice.create({
    data: {
      restaurantId,
      billingMonth: String(formData.get("billingMonth") || new Date().toISOString().slice(0, 7)),
      planName: String(formData.get("planName") || "Pilot"),
      amount: Number(formData.get("amount") || 0),
      status,
      dueDate: formData.get("dueDate") ? new Date(String(formData.get("dueDate"))) : null,
      notes: String(formData.get("notes") || "") || null
    }
  });
  await db.activityLog.create({ data: { userId: admin.id, restaurantId, action: "BILLING_INVOICE_CREATED", description: "Invoice created from restaurant control page" } });
  revalidatePath(`/admin/restaurants/${restaurantId}`);
}

export default async function AdminRestaurantDetail({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdmin();
  const { id } = await params;
  const restaurant = await db.restaurant.findUnique({
    where: { id },
    include: {
      users: true,
      tables: true,
      orders: { where: { status: "PAID" }, select: { total: true } },
      billingInvoices: { orderBy: { createdAt: "desc" }, take: 12 },
      activityLogs: { orderBy: { createdAt: "desc" }, take: 10 }
    }
  });
  if (!restaurant) notFound();
  const revenue = restaurant.orders.reduce((sum, order) => sum + Number(order.total), 0);
  const openBilling = restaurant.billingInvoices
    .filter((invoice) => invoice.status === "DUE" || invoice.status === "OVERDUE")
    .reduce((sum, invoice) => sum + Number(invoice.amount), 0);

  return (
    <main className="mx-auto max-w-6xl p-4 lg:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{restaurant.name}</h1>
          <p className="text-sm text-muted-foreground">Super-admin account control, billing, recovery, and restaurant records.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/admin/restaurants/${restaurant.id}/orders`}><Button variant="outline">Orders</Button></a>
          <a href={`/admin/restaurants/${restaurant.id}/reports`}><Button variant="outline">Reports</Button></a>
          <a href={`/admin/restaurants/${restaurant.id}/qr-codes`}><Button>QR Codes</Button></a>
        </div>
      </div>

      <div className="mb-5 grid gap-4 md:grid-cols-4">
        <Stat title="Tables" value={restaurant.tables.length} />
        <Stat title="Manager Users" value={restaurant.users.length} />
        <Stat title="Order Revenue" value={formatCurrency(revenue)} />
        <Stat title="Open Billing" value={formatCurrency(openBilling)} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Edit restaurant</CardTitle></CardHeader>
          <CardContent>
            <form action={updateRestaurant} className="space-y-3">
              <input type="hidden" name="id" value={restaurant.id} />
              <Input name="name" defaultValue={restaurant.name} />
              <Input name="branchName" defaultValue={restaurant.branchName} />
              <Input name="city" defaultValue={restaurant.city} />
              <Input name="address" defaultValue={restaurant.address} />
              <Input name="phone" defaultValue={restaurant.phone} />
              <select name="status" defaultValue={restaurant.status} className="h-10 w-full rounded-md border bg-white px-3 text-sm">
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
              <select name="subscriptionStatus" defaultValue={restaurant.subscriptionStatus} className="h-10 w-full rounded-md border bg-white px-3 text-sm">
                <option value="PILOT">PILOT</option>
                <option value="STARTER">STARTER</option>
                <option value="GROWTH">GROWTH</option>
                <option value="PRO">PRO</option>
                <option value="EXPIRED">EXPIRED</option>
              </select>
              <Input name="serviceChargePercent" type="number" defaultValue={restaurant.serviceChargePercent.toString()} placeholder="Service charge %" />
              <Input name="taxPercent" type="number" defaultValue={restaurant.taxPercent.toString()} placeholder="Tax %" />
              <Input name="customerCancelWindowMinutes" type="number" defaultValue={restaurant.customerCancelWindowMinutes} placeholder="Cancel window minutes" />
              <Input name="pilotEndDate" type="date" />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="orderingEnabled" defaultChecked={restaurant.orderingEnabled} /> Ordering enabled</label>
              <Button className="w-full">Save Restaurant</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Account Recovery</CardTitle></CardHeader>
          <CardContent>
            <form action={createManager} className="mb-5 space-y-3 rounded-md border p-3">
              <input type="hidden" name="restaurantId" value={restaurant.id} />
              <p className="font-semibold">Create manager login</p>
              <Input name="name" placeholder="Name" />
              <Input name="email" type="email" placeholder="Email" required />
              <Input name="password" placeholder="Password" defaultValue="Manager12345" />
              <Button className="w-full">Create Manager</Button>
            </form>
            <div className="space-y-3">
              {restaurant.users.map((user) => (
                <div key={user.id} className="rounded-md border p-3 text-sm">
                  <p className="font-bold">{user.email}</p>
                  <p className="text-muted-foreground">{user.role} · {user.isActive ? "Active" : "Disabled"}</p>
                  <form action={resetManagerPassword} className="mt-3 flex flex-wrap gap-2">
                    <input type="hidden" name="restaurantId" value={restaurant.id} />
                    <input type="hidden" name="userId" value={user.id} />
                    <Input name="password" defaultValue="Manager12345" />
                    <Button variant="outline">Reset Password</Button>
                  </form>
                  <form action={toggleManagerStatus} className="mt-2">
                    <input type="hidden" name="restaurantId" value={restaurant.id} />
                    <input type="hidden" name="userId" value={user.id} />
                    <input type="hidden" name="nextActive" value={String(!user.isActive)} />
                    <Button variant={user.isActive ? "destructive" : "default"}>{user.isActive ? "Disable Login" : "Enable Login"}</Button>
                  </form>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Create Billing Record</CardTitle></CardHeader>
          <CardContent>
            <form action={createInvoice} className="grid gap-3 md:grid-cols-2">
              <input type="hidden" name="restaurantId" value={restaurant.id} />
              <Input name="billingMonth" type="month" defaultValue={new Date().toISOString().slice(0, 7)} />
              <Input name="amount" type="number" placeholder="Amount" defaultValue={0} />
              <Input name="planName" placeholder="Plan" defaultValue={restaurant.subscriptionStatus} />
              <select name="status" className="h-10 rounded-md border bg-white px-3 text-sm" defaultValue="DUE">
                <option value="DRAFT">DRAFT</option>
                <option value="DUE">DUE</option>
                <option value="PAID">PAID</option>
                <option value="OVERDUE">OVERDUE</option>
                <option value="WAIVED">WAIVED</option>
              </select>
              <Input name="dueDate" type="date" />
              <Textarea className="md:col-span-2" name="notes" placeholder="Invoice notes" />
              <Button className="md:col-span-2">Create Invoice</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Billing History</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {restaurant.billingInvoices.map((invoice) => (
              <div key={invoice.id} className="flex justify-between gap-3 rounded-md border p-3 text-sm">
                <div>
                  <p className="font-bold">{invoice.billingMonth} · {invoice.planName}</p>
                  <p className="text-muted-foreground">{invoice.status} {invoice.paidAt ? `· paid ${formatPkDateTime(invoice.paidAt)}` : ""}</p>
                </div>
                <p className="font-bold">{formatCurrency(invoice.amount.toString())}</p>
              </div>
            ))}
            {restaurant.billingInvoices.length === 0 ? <p className="text-sm text-muted-foreground">No billing records yet.</p> : null}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Recent Admin Activity</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {restaurant.activityLogs.map((log) => (
              <p key={log.id} className="flex justify-between gap-3 border-b pb-2 text-sm">
                <span><strong>{log.action}</strong> · {log.description}</span>
                <span className="text-muted-foreground">{formatPkDateTime(log.createdAt)}</span>
              </p>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function Stat({ title, value }: { title: string; value: React.ReactNode }) {
  return <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">{title}</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{value}</p></CardContent></Card>;
}
