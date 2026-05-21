import Link from "next/link";
import { revalidatePath } from "next/cache";
import { InvoiceStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/permissions";
import { AdminBreadcrumbs } from "@/components/admin/admin-breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmSubmitButton, SubmitButton } from "@/components/ui/confirm-submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatPkDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

function text(formData: FormData, key: string, fallback = "") {
  return String(formData.get(key) || fallback).trim();
}

async function createPaymentAccount(formData: FormData) {
  "use server";
  const user = await requirePlatformAdmin();
  const restaurantId = text(formData, "restaurantId") || null;
  await db.billingPaymentAccount.create({
    data: {
      restaurantId,
      label: text(formData, "label"),
      method: text(formData, "method", "BANK_TRANSFER"),
      accountTitle: text(formData, "accountTitle"),
      accountNumber: text(formData, "accountNumber"),
      bankName: text(formData, "bankName") || null,
      instructions: text(formData, "instructions") || null,
      isActive: true
    }
  });
  await db.activityLog.create({ data: { userId: user.id, restaurantId, action: "BILLING_PAYMENT_ACCOUNT_CREATED", description: text(formData, "label") } });
  revalidatePath("/admin/billing");
  revalidatePath("/dashboard/billing");
}

async function togglePaymentAccount(formData: FormData) {
  "use server";
  const user = await requirePlatformAdmin();
  const id = text(formData, "id");
  const isActive = text(formData, "isActive") === "true";
  const account = await db.billingPaymentAccount.update({ where: { id }, data: { isActive } });
  await db.activityLog.create({ data: { userId: user.id, restaurantId: account.restaurantId, action: "BILLING_PAYMENT_ACCOUNT_UPDATED", description: `${account.label} ${isActive ? "activated" : "disabled"}` } });
  revalidatePath("/admin/billing");
  revalidatePath("/dashboard/billing");
}

async function createInvoice(formData: FormData) {
  "use server";
  const user = await requirePlatformAdmin();
  const restaurantId = text(formData, "restaurantId");
  const billingMonth = text(formData, "billingMonth", new Date().toISOString().slice(0, 7));
  const amount = Number(formData.get("amount") || 0);
  const submittedPaymentAccountId = text(formData, "paymentAccountId");
  const paymentAccount = submittedPaymentAccountId
    ? await db.billingPaymentAccount.findFirst({
        where: { id: submittedPaymentAccountId, isActive: true, OR: [{ restaurantId: null }, { restaurantId }] },
        select: { id: true }
      })
    : null;
  const invoice = await db.billingInvoice.create({
    data: {
      restaurantId,
      paymentAccountId: paymentAccount?.id || null,
      billingMonth,
      amount,
      planName: text(formData, "planName", "Pilot"),
      status: text(formData, "status", "DUE") as InvoiceStatus,
      invoiceSeenAt: null,
      dueDate: formData.get("dueDate") ? new Date(String(formData.get("dueDate"))) : null,
      notes: text(formData, "notes") || null
    }
  });
  await db.activityLog.create({ data: { userId: user.id, restaurantId, action: "BILLING_INVOICE_CREATED", description: `${billingMonth} invoice created and sent to manager dashboard` } });
  revalidatePath("/admin/billing");
  revalidatePath(`/admin/billing/invoices/${invoice.id}/print`);
  revalidatePath("/dashboard/billing");
}

async function updateInvoiceStatus(formData: FormData) {
  "use server";
  const user = await requirePlatformAdmin();
  const id = text(formData, "id");
  const status = text(formData, "status") as InvoiceStatus;
  const paymentReference = text(formData, "paymentReference") || null;
  const existingInvoice = await db.billingInvoice.findUnique({ where: { id }, select: { status: true } });
  const managerStatusNotification = existingInvoice?.status !== status && (status === "DUE" || status === "OVERDUE" || status === "WAIVED");
  const invoice = await db.billingInvoice.update({
    where: { id },
    data: {
      status,
      invoiceSeenAt: managerStatusNotification ? null : undefined,
      paidAt: status === "PAID" ? new Date() : null,
      paymentConfirmedAt: status === "PAID" ? new Date() : null,
      paymentConfirmationSeenAt: status === "PAID" ? null : undefined,
      paymentConfirmedById: status === "PAID" ? user.id : null,
      paymentReference,
      paymentClaimedAt: status === "PAID" ? null : undefined,
      paymentClaimSeenAt: status === "PAID" ? new Date() : undefined
    }
  });
  await db.activityLog.create({ data: { userId: user.id, restaurantId: invoice.restaurantId, action: "BILLING_INVOICE_UPDATED", description: `${invoice.billingMonth} invoice changed to ${status}` } });
  revalidatePath("/admin/billing");
  revalidatePath("/dashboard/billing");
}

async function confirmManagerPayment(formData: FormData) {
  "use server";
  const user = await requirePlatformAdmin();
  const id = text(formData, "id");
  const invoice = await db.billingInvoice.update({
    where: { id },
    data: {
      status: "PAID",
      paidAt: new Date(),
      paymentConfirmedAt: new Date(),
      paymentConfirmationSeenAt: null,
      paymentConfirmedById: user.id,
      paymentReference: text(formData, "paymentReference") || text(formData, "claimReference") || null,
      paymentClaimSeenAt: new Date(),
      paymentClaimedAt: null,
      paymentRejectedAt: null,
      paymentRejectionNote: null
    }
  });
  await db.activityLog.create({ data: { userId: user.id, restaurantId: invoice.restaurantId, action: "BILLING_PAYMENT_CONFIRMED", description: `${invoice.billingMonth} invoice payment confirmed by super admin` } });
  revalidatePath("/admin/billing");
  revalidatePath("/dashboard/billing");
}

async function markPaymentNotReceived(formData: FormData) {
  "use server";
  const user = await requirePlatformAdmin();
  const id = text(formData, "id");
  const note = text(formData, "paymentRejectionNote", "Payment was not received by Super Admin. Please check the transaction and submit payment again.");
  const invoice = await db.billingInvoice.update({
    where: { id },
    data: {
      status: "DUE",
      paymentClaimedAt: null,
      paymentClaimSeenAt: new Date(),
      paymentRejectedAt: new Date(),
      paymentRejectionSeenAt: null,
      paymentRejectionNote: note
    }
  });
  await db.activityLog.create({ data: { userId: user.id, restaurantId: invoice.restaurantId, action: "BILLING_PAYMENT_NOT_RECEIVED", description: `${invoice.billingMonth} payment claim rejected: ${note}` } });
  revalidatePath("/admin/billing");
  revalidatePath("/dashboard/billing");
}

async function sendPaymentReminder(formData: FormData) {
  "use server";
  const user = await requirePlatformAdmin();
  const id = text(formData, "id");
  const fallbackMessage = "Reminder from OrderTable billing: this invoice is still unpaid. Please complete payment before the due date or submit the transaction reference from your manager billing dashboard.";
  const reminderMessage = text(formData, "reminderMessage", fallbackMessage);
  const invoice = await db.billingInvoice.update({
    where: { id },
    data: {
      paymentReminderAt: new Date(),
      paymentReminderSeenAt: null,
      paymentReminderCount: { increment: 1 },
      paymentReminderMessage: reminderMessage,
      status: "OVERDUE"
    }
  });
  await db.activityLog.create({
    data: {
      userId: user.id,
      restaurantId: invoice.restaurantId,
      action: "BILLING_PAYMENT_REMINDER_SENT",
      description: `${invoice.billingMonth} payment reminder sent to manager dashboard`
    }
  });
  revalidatePath("/admin/billing");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/billing");
}

function invoiceStatusClass(status: InvoiceStatus) {
  if (status === "PAID") return "border-green-200 bg-green-50 text-green-800";
  if (status === "OVERDUE") return "border-red-200 bg-red-50 text-red-800";
  if (status === "DUE") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "WAIVED") return "border-slate-200 bg-slate-50 text-slate-700";
  return "border-slate-200 bg-white text-slate-700";
}

export default async function AdminBillingPage() {
  await requirePlatformAdmin();
  const [restaurants, invoices, paid, open, accounts, pendingClaims] = await Promise.all([
    db.restaurant.findMany({ orderBy: { name: "asc" } }),
    db.billingInvoice.findMany({ include: { restaurant: true, paymentAccount: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.billingInvoice.aggregate({ where: { status: "PAID" }, _sum: { amount: true } }),
    db.billingInvoice.aggregate({ where: { status: { in: ["DUE", "OVERDUE"] } }, _sum: { amount: true } }),
    db.billingPaymentAccount.findMany({ include: { restaurant: true }, orderBy: [{ isActive: "desc" }, { createdAt: "desc" }] }),
    db.billingInvoice.count({ where: { paymentClaimedAt: { not: null }, status: { not: "PAID" } } })
  ]);
  const activeAccounts = accounts.filter((account) => account.isActive);
  const unseenPaymentClaimIds = invoices
    .filter((invoice) => invoice.paymentClaimedAt && invoice.status !== "PAID" && (!invoice.paymentClaimSeenAt || invoice.paymentClaimSeenAt < invoice.paymentClaimedAt))
    .map((invoice) => invoice.id);
  if (unseenPaymentClaimIds.length > 0) {
    await db.billingInvoice.updateMany({
      where: { id: { in: unseenPaymentClaimIds } },
      data: { paymentClaimSeenAt: new Date() }
    });
  }
  const unpaidInvoices = invoices.filter((invoice) => invoice.status !== "PAID");
  const paidInvoices = invoices.filter((invoice) => invoice.status === "PAID");
  const totalPaidCount = paidInvoices.length;
  const totalUnpaidCount = unpaidInvoices.length;

  return (
    <main className="mx-auto max-w-7xl p-4 lg:p-6">
      <AdminBreadcrumbs items={[{ label: "Settings", href: "/admin/settings" }, { label: "Billing" }]} />
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Platform Billing</h1>
        <p className="text-sm text-muted-foreground">Create monthly invoices, send them to manager dashboards, define payment accounts, and confirm manager payment requests.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Paid invoices</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatCurrency(paid._sum.amount?.toString() || 0)}</p>
            <p className="text-xs text-muted-foreground">{totalPaidCount} confirmed paid bills</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Due / overdue</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatCurrency(open._sum.amount?.toString() || 0)}</p>
            <p className="text-xs text-muted-foreground">{totalUnpaidCount} unpaid bills</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Payment requests</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{pendingClaims}</p><p className="text-xs text-muted-foreground">Waiting for confirmation</p></CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Payment Accounts</CardTitle>
            <p className="text-sm text-muted-foreground">These instructions appear on manager billing pages and printable invoices.</p>
          </CardHeader>
          <CardContent>
            <form action={createPaymentAccount} className="grid gap-3 md:grid-cols-2">
              <Input name="label" placeholder="Label, e.g. Main Bank Account" required />
              <select name="method" className="h-10 rounded-md border bg-white px-3 text-sm" defaultValue="BANK_TRANSFER">
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="JAZZCASH">JazzCash</option>
                <option value="EASYPAISA">EasyPaisa</option>
                <option value="OTHER">Other</option>
              </select>
              <Input name="accountTitle" placeholder="Account title" required />
              <Input name="accountNumber" placeholder="Account / wallet number" required />
              <Input name="bankName" placeholder="Bank name optional" />
              <select name="restaurantId" className="h-10 rounded-md border bg-white px-3 text-sm" defaultValue="">
                <option value="">Available to all restaurants</option>
                {restaurants.map((restaurant) => <option key={restaurant.id} value={restaurant.id}>{restaurant.name} - {restaurant.branchName}</option>)}
              </select>
              <Textarea className="md:col-span-2" name="instructions" placeholder="Extra payment instructions, e.g. send screenshot/reference after transfer" />
              <SubmitButton className="md:col-span-2" pendingText="Saving account...">Add Payment Account</SubmitButton>
            </form>

            <div className="mt-5 grid gap-3">
              {accounts.map((account) => (
                <div key={account.id} className="rounded-md border p-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">{account.label} <span className="font-normal text-muted-foreground">({account.method})</span></p>
                      <p>{account.accountTitle} - {account.accountNumber}</p>
                      <p className="text-muted-foreground">{account.bankName || "No bank name"} - {account.restaurant ? account.restaurant.name : "All restaurants"}</p>
                    </div>
                    <form action={togglePaymentAccount}>
                      <input type="hidden" name="id" value={account.id} />
                      <input type="hidden" name="isActive" value={String(!account.isActive)} />
                      <Button size="sm" variant="outline">{account.isActive ? "Disable" : "Activate"}</Button>
                    </form>
                  </div>
                </div>
              ))}
              {accounts.length === 0 ? <p className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">No payment accounts added yet.</p> : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Create Monthly Invoice</CardTitle>
            <p className="text-sm text-muted-foreground">Creating a due invoice makes it visible in the selected manager dashboard.</p>
          </CardHeader>
          <CardContent>
            <form action={createInvoice} className="grid gap-3 md:grid-cols-3">
              <select name="restaurantId" className="h-10 rounded-md border bg-white px-3 text-sm" required>
                {restaurants.map((restaurant) => <option key={restaurant.id} value={restaurant.id}>{restaurant.name} - {restaurant.branchName}</option>)}
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
                <option value="DRAFT">Draft</option>
                <option value="DUE">Due - send to manager</option>
                <option value="OVERDUE">Overdue</option>
                <option value="WAIVED">Waived</option>
              </select>
              <Input name="dueDate" type="date" />
              <select name="paymentAccountId" className="h-10 rounded-md border bg-white px-3 text-sm md:col-span-3" defaultValue="">
                <option value="">Use any active payment account</option>
                {activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.label} - {account.method} - {account.restaurant?.name || "All restaurants"}</option>)}
              </select>
              <Textarea className="md:col-span-3" name="notes" placeholder="Invoice notes visible to manager" />
              <SubmitButton className="md:col-span-3" pendingText="Creating invoice...">Create & Send Invoice</SubmitButton>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold">Unpaid invoices</h2>
              <p className="text-sm text-muted-foreground">Invoices sent to managers, pending payment, overdue, or waiting for payment verification.</p>
            </div>
            <span className="rounded-full border bg-white px-3 py-1 text-xs font-bold">{unpaidInvoices.length} open</span>
          </div>
          {unpaidInvoices.map((invoice) => <AdminInvoiceRow key={invoice.id} invoice={invoice} mode="unpaid" />)}
          {unpaidInvoices.length === 0 ? <p className="rounded-lg border bg-white p-6 text-center text-muted-foreground">No unpaid invoices.</p> : null}
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold">Paid bills</h2>
              <p className="text-sm text-muted-foreground">Confirmed transaction history with manager source account and platform receiving account.</p>
            </div>
            <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-bold text-green-800">{paidInvoices.length} paid</span>
          </div>
          {paidInvoices.map((invoice) => <AdminInvoiceRow key={invoice.id} invoice={invoice} mode="paid" />)}
          {paidInvoices.length === 0 ? <p className="rounded-lg border bg-white p-6 text-center text-muted-foreground">No paid bills confirmed yet.</p> : null}
        </section>
      </div>
    </main>
  );
}

function AdminInvoiceRow({ invoice, mode }: { invoice: any; mode: "paid" | "unpaid" }) {
  const hasPaymentRequest = Boolean(invoice.paymentClaimedAt && invoice.status !== "PAID");
  const isPaid = invoice.status === "PAID";
  const sentAt = formatPkDateTime(invoice.createdAt);
  const dueAt = invoice.dueDate ? formatPkDateTime(invoice.dueDate) : "No due date";
  const paidAt = invoice.paidAt ? formatPkDateTime(invoice.paidAt) : "Not confirmed";
  const receivingAccount = invoice.paymentAccount
    ? `${invoice.paymentAccount.label} (${invoice.paymentAccount.method}) - ${invoice.paymentAccount.accountTitle} / ${invoice.paymentAccount.accountNumber}`
    : "Any active platform billing account";

  return (
    <Card className={hasPaymentRequest ? "border-blue-300 bg-blue-50/40" : isPaid ? "border-green-200 bg-green-50/40" : ""}>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-bold">{invoice.restaurant.name} - {invoice.billingMonth}</p>
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${invoiceStatusClass(invoice.status)}`}>{invoice.status}</span>
            </div>
            <p className="text-sm text-muted-foreground">{invoice.planName} - {formatCurrency(invoice.amount.toString())}</p>
            <dl className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
              <div><dt className="font-semibold text-foreground">Invoice sent</dt><dd>{sentAt}</dd></div>
              <div><dt className="font-semibold text-foreground">Due date</dt><dd>{dueAt}</dd></div>
              <div><dt className="font-semibold text-foreground">Paid / confirmed</dt><dd>{paidAt}</dd></div>
              <div><dt className="font-semibold text-foreground">Invoice ID</dt><dd className="break-all">{invoice.id}</dd></div>
            </dl>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/admin/billing/invoices/${invoice.id}/print`}><Button variant="outline">PDF / Print</Button></Link>
            <Link href={`/admin/restaurants/${invoice.restaurantId}`}><Button variant="outline">Restaurant</Button></Link>
          </div>
        </div>

        <div className="mt-3 grid gap-2 rounded-md border bg-white p-3 text-sm md:grid-cols-2">
          <p><span className="font-semibold">From manager account:</span> {invoice.paymentClaimFromAccount || invoice.paymentClaimMethod || "Not submitted yet"}</p>
          <p><span className="font-semibold">To platform account:</span> {receivingAccount}</p>
          <p><span className="font-semibold">Transaction reference:</span> {invoice.paymentReference || invoice.paymentClaimReference || "Not provided"}</p>
          <p><span className="font-semibold">Manager claim time:</span> {invoice.paymentClaimedAt ? formatPkDateTime(invoice.paymentClaimedAt) : "No payment claim"}</p>
        </div>

        {invoice.paymentReminderAt && !isPaid ? (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Reminder sent {formatPkDateTime(invoice.paymentReminderAt)} ({invoice.paymentReminderCount || 1} total). {invoice.paymentReminderMessage}
          </div>
        ) : null}

        {hasPaymentRequest ? (
          <div className="mt-3 rounded-md border border-blue-200 bg-white p-3 text-sm">
            <p className="font-semibold text-blue-950">Manager marked this invoice as paid. Confirm only after money is received.</p>
            <p className="mt-1 text-muted-foreground">Method: {invoice.paymentClaimMethod || "Not provided"} - Reference: {invoice.paymentClaimReference || "Not provided"}</p>
            {invoice.paymentClaimFromAccount ? <p className="mt-1 text-muted-foreground">Paid from: {invoice.paymentClaimFromAccount}</p> : null}
            {invoice.paymentClaimNote ? <p className="mt-1 text-muted-foreground">Note: {invoice.paymentClaimNote}</p> : null}
            <form action={confirmManagerPayment} className="mt-3 flex flex-wrap gap-2">
              <input type="hidden" name="id" value={invoice.id} />
              <input type="hidden" name="claimReference" value={invoice.paymentClaimReference || ""} />
              <Input name="paymentReference" placeholder="Final received reference optional" defaultValue={invoice.paymentClaimReference || ""} />
              <ConfirmSubmitButton
                variant="default"
                size="md"
                message="Confirm payment received? This will mark the manager invoice as PAID."
                pendingText="Confirming..."
              >
                Confirm Payment Received
              </ConfirmSubmitButton>
            </form>
            <form action={markPaymentNotReceived} className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
              <input type="hidden" name="id" value={invoice.id} />
              <Input name="paymentRejectionNote" placeholder="Message to manager, e.g. payment not received in account" defaultValue="Payment was not received yet. Please verify the transaction and submit again." />
              <ConfirmSubmitButton
                variant="destructive"
                size="md"
                message="Mark this payment as not received and notify the manager dashboard?"
                pendingText="Notifying..."
              >
                Not Received
              </ConfirmSubmitButton>
            </form>
          </div>
        ) : null}

        {mode === "unpaid" && !hasPaymentRequest && (invoice.status === "DUE" || invoice.status === "OVERDUE") ? (
          <form action={sendPaymentReminder} className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
            <input type="hidden" name="id" value={invoice.id} />
            <Input
              name="reminderMessage"
              defaultValue="Reminder from OrderTable billing: this invoice is still unpaid. Please pay the due bill or submit the payment transaction reference from your manager billing dashboard."
            />
            <ConfirmSubmitButton
              variant="outline"
              size="md"
              message="Send this payment reminder to the manager dashboard?"
              pendingText="Sending..."
            >
              Send Reminder
            </ConfirmSubmitButton>
          </form>
        ) : null}

        <form action={updateInvoiceStatus} className="mt-3 flex flex-wrap gap-2">
          <input type="hidden" name="id" value={invoice.id} />
          <select name="status" defaultValue={invoice.status} className="h-10 rounded-md border bg-white px-3 text-sm">
            <option value="DRAFT">Draft</option>
            <option value="DUE">Due</option>
            <option value="PAID">Paid / confirmed</option>
            <option value="OVERDUE">Overdue</option>
            <option value="WAIVED">Waived</option>
          </select>
          <Input name="paymentReference" placeholder="Payment reference" defaultValue={invoice.paymentReference || invoice.paymentClaimReference || ""} />
          <SubmitButton pendingText="Saving...">Save Status</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
