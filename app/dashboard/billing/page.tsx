import Link from "next/link";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getManagerRestaurant } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatPkDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

function text(formData: FormData, key: string, fallback = "") {
  return String(formData.get(key) || fallback).trim();
}

async function submitPaymentRequest(formData: FormData) {
  "use server";
  const { user, restaurant } = await getManagerRestaurant();
  const invoiceId = text(formData, "invoiceId");
  const invoice = await db.billingInvoice.findFirst({ where: { id: invoiceId, restaurantId: restaurant.id } });
  if (!invoice || invoice.status === "PAID") return;

  await db.$transaction(async (tx) => {
    await tx.billingInvoice.update({
      where: { id: invoice.id },
      data: {
        paymentClaimedAt: new Date(),
        paymentClaimMethod: text(formData, "paymentClaimMethod"),
        paymentClaimReference: text(formData, "paymentClaimReference") || null,
        paymentClaimFromAccount: text(formData, "paymentClaimFromAccount") || null,
        paymentClaimNote: text(formData, "paymentClaimNote") || null,
        paymentRejectedAt: null,
        paymentRejectionNote: null
      }
    });
    await tx.activityLog.create({
      data: {
        userId: user.id,
        restaurantId: restaurant.id,
        action: "BILLING_PAYMENT_REQUESTED",
        description: `${invoice.billingMonth} invoice marked paid by manager, waiting for platform billing confirmation`
      }
    });
  });
  revalidatePath("/dashboard/billing");
  revalidatePath("/admin/billing");
}

export default async function ManagerBillingPage() {
  const { restaurant } = await getManagerRestaurant();
  const [invoices, accounts] = await Promise.all([
    db.billingInvoice.findMany({
      where: { restaurantId: restaurant.id, status: { not: "DRAFT" } },
      include: { paymentAccount: true },
      orderBy: { createdAt: "desc" }
    }),
    db.billingPaymentAccount.findMany({
      where: { isActive: true, OR: [{ restaurantId: null }, { restaurantId: restaurant.id }] },
      orderBy: [{ restaurantId: "desc" }, { createdAt: "asc" }]
    })
  ]);

  const openInvoices = invoices.filter((invoice) => invoice.status === "DUE" || invoice.status === "OVERDUE");
  const confirmedInvoices = invoices.filter((invoice) => invoice.status === "PAID");
  const reminderInvoices = invoices.filter((invoice) => invoice.paymentReminderAt && invoice.status !== "PAID");
  const unpaidInvoices = invoices.filter((invoice) => invoice.status === "DUE" || invoice.status === "OVERDUE" || Boolean(invoice.paymentClaimedAt && invoice.status !== "PAID"));
  const otherInvoices = invoices.filter((invoice) => invoice.status !== "PAID" && !unpaidInvoices.some((openInvoice) => openInvoice.id === invoice.id));

  return (
    <main className="p-4 lg:p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-sm text-muted-foreground">View monthly OrderTable platform invoices, payment instructions, and confirmation history.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Stat title="Open invoices" value={openInvoices.length} />
        <Stat title="Confirmed paid" value={confirmedInvoices.length} />
        <Stat title="Open amount" value={formatCurrency(openInvoices.reduce((sum, invoice) => sum + Number(invoice.amount), 0))} />
      </div>

      {reminderInvoices.length > 0 ? (
        <div className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-bold">Payment reminder from OrderTable billing</p>
          <p className="mt-1">
            You have {reminderInvoices.length} due bill{reminderInvoices.length === 1 ? "" : "s"} with a recent reminder. Please complete the payment or submit the transaction reference for verification.
          </p>
          <div className="mt-3 grid gap-2">
            {reminderInvoices.slice(0, 3).map((invoice) => (
              <p key={invoice.id} className="rounded-md border border-amber-200 bg-white p-2">
                <span className="font-semibold">{invoice.billingMonth}:</span> {invoice.paymentReminderMessage || "Please pay this due invoice."}
                {invoice.paymentReminderAt ? <span className="block text-xs text-muted-foreground">Sent {formatPkDateTime(invoice.paymentReminderAt)}</span> : null}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Payment Accounts</CardTitle>
          <p className="text-sm text-muted-foreground">Pay to one of these platform billing accounts, then submit your payment reference below.</p>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {accounts.map((account) => (
            <div key={account.id} className="rounded-md border p-3 text-sm">
              <p className="font-bold">{account.label} ({account.method})</p>
              <p>Account title: {account.accountTitle}</p>
              <p>Account number: {account.accountNumber}</p>
              {account.bankName ? <p>Bank: {account.bankName}</p> : null}
              {account.instructions ? <p className="mt-2 text-muted-foreground">{account.instructions}</p> : null}
            </div>
          ))}
          {accounts.length === 0 ? <p className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">Payment accounts are not configured yet. Please contact platform support.</p> : null}
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold">New and unpaid invoices</h2>
              <p className="text-sm text-muted-foreground">Fresh invoices from platform billing appear here first until payment is confirmed.</p>
            </div>
            <span className="rounded-full border bg-white px-3 py-1 text-xs font-bold">{unpaidInvoices.length} open</span>
          </div>
          {unpaidInvoices.map((invoice) => <ManagerInvoiceCard key={invoice.id} invoice={invoice} accounts={accounts} />)}
          {unpaidInvoices.length === 0 ? <p className="rounded-lg border bg-white p-6 text-center text-muted-foreground">No unpaid bills right now.</p> : null}
          {otherInvoices.map((invoice) => <ManagerInvoiceCard key={invoice.id} invoice={invoice} accounts={accounts} />)}
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold">Paid bills</h2>
              <p className="text-sm text-muted-foreground">Confirmed bill history with transaction date, source account, and receiving account.</p>
            </div>
            <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-bold text-green-800">{confirmedInvoices.length} paid</span>
          </div>
          {confirmedInvoices.map((invoice) => <ManagerInvoiceCard key={invoice.id} invoice={invoice} accounts={accounts} />)}
          {confirmedInvoices.length === 0 ? <p className="rounded-lg border bg-white p-6 text-center text-muted-foreground">No paid bills confirmed yet.</p> : null}
        </section>
      </div>
    </main>
  );
}

function ManagerInvoiceCard({ invoice, accounts }: { invoice: any; accounts: any[] }) {
  const pendingConfirmation = Boolean(invoice.paymentClaimedAt && invoice.status !== "PAID");
  const rejectedPayment = Boolean(invoice.paymentRejectedAt && invoice.status !== "PAID");
  const selectedAccount = invoice.paymentAccount || accounts[0];
  const paid = invoice.status === "PAID";
  const receivingAccount = selectedAccount
    ? `${selectedAccount.label} - ${selectedAccount.method} - ${selectedAccount.accountTitle} / ${selectedAccount.accountNumber}`
    : "Platform payment account not configured";

  return (
    <Card className={paid ? "border-green-200 bg-green-50/40" : pendingConfirmation ? "border-blue-300 bg-blue-50/40" : rejectedPayment ? "border-red-300 bg-red-50/40" : invoice.paymentReminderAt ? "border-amber-300 bg-amber-50/40" : ""}>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-bold">{invoice.billingMonth} Monthly Invoice</p>
            <p className="text-sm text-muted-foreground">{invoice.planName} - {formatCurrency(invoice.amount.toString())} - {invoice.status}</p>
            <p className="text-xs text-muted-foreground">Sent {formatPkDateTime(invoice.createdAt)}{invoice.dueDate ? ` - Due ${formatPkDateTime(invoice.dueDate)}` : ""}</p>
          </div>
          <Link href={`/dashboard/billing/${invoice.id}/print`}><Button variant="outline">PDF / Print</Button></Link>
        </div>

        {invoice.paymentReminderAt && !paid ? (
          <div className="mt-3 rounded-md border border-amber-200 bg-white p-3 text-sm text-amber-900">
            <p className="font-semibold">Payment reminder</p>
            <p className="mt-1">{invoice.paymentReminderMessage || "Please clear this due invoice and submit the payment reference."}</p>
            <p className="mt-1 text-xs text-muted-foreground">Sent {formatPkDateTime(invoice.paymentReminderAt)}</p>
          </div>
        ) : null}

        {invoice.notes ? <p className="mt-3 rounded-md border p-3 text-sm text-muted-foreground">{invoice.notes}</p> : null}

        <div className="mt-3 grid gap-2 rounded-md border bg-white p-3 text-sm md:grid-cols-2">
          <p><span className="font-semibold">Pay to platform account:</span> {receivingAccount}</p>
          <p><span className="font-semibold">Paid from manager account:</span> {invoice.paymentClaimFromAccount || "Not submitted yet"}</p>
          <p><span className="font-semibold">Transaction reference:</span> {invoice.paymentReference || invoice.paymentClaimReference || "Not provided"}</p>
          <p><span className="font-semibold">Paid / confirmed at:</span> {invoice.paidAt ? formatPkDateTime(invoice.paidAt) : pendingConfirmation ? "Waiting for platform confirmation" : "Not paid yet"}</p>
          {selectedAccount?.bankName ? <p><span className="font-semibold">Bank:</span> {selectedAccount.bankName}</p> : null}
          {selectedAccount?.instructions ? <p><span className="font-semibold">Instructions:</span> {selectedAccount.instructions}</p> : null}
        </div>

        {paid ? (
          <div className="mt-3 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            Paid and confirmed by platform billing{invoice.paidAt ? ` on ${formatPkDateTime(invoice.paidAt)}` : ""}.
          </div>
        ) : invoice.status === "WAIVED" ? (
          <div className="mt-3 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            This invoice has been waived by platform billing. No payment action is required.
          </div>
        ) : pendingConfirmation ? (
          <div className="mt-3 rounded-md border border-blue-200 bg-white p-3 text-sm text-blue-900">
            Payment submitted. Waiting for platform billing confirmation.
            <p className="mt-1 text-muted-foreground">Reference: {invoice.paymentClaimReference || "Not provided"} - Method: {invoice.paymentClaimMethod || "Not provided"}</p>
          </div>
        ) : (
          <>
          {rejectedPayment ? (
            <div className="mt-3 rounded-md border border-red-200 bg-white p-3 text-sm text-red-800">
              <p className="font-semibold">Platform billing marked the previous payment as not received.</p>
              <p className="mt-1">{invoice.paymentRejectionNote || "Please verify your transaction and submit payment again."}</p>
              {invoice.paymentRejectedAt ? <p className="mt-1 text-xs text-muted-foreground">Updated {formatPkDateTime(invoice.paymentRejectedAt)}</p> : null}
            </div>
          ) : null}
          <form action={submitPaymentRequest} className="mt-3 grid gap-3 md:grid-cols-[180px_1fr_auto]">
            <input type="hidden" name="invoiceId" value={invoice.id} />
            <select name="paymentClaimMethod" className="h-10 rounded-md border bg-white px-3 text-sm" defaultValue="BANK_TRANSFER">
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="JAZZCASH">JazzCash</option>
              <option value="EASYPAISA">EasyPaisa</option>
              <option value="OTHER">Other</option>
            </select>
            <Input name="paymentClaimReference" placeholder="Transaction/reference number" />
            <ConfirmSubmitButton
              variant="default"
              size="md"
              message="Submit payment request? The invoice will be marked as waiting for confirmation until platform billing verifies receipt."
              pendingText="Submitting..."
            >
              I Have Paid
            </ConfirmSubmitButton>
            <Input className="md:col-span-3" name="paymentClaimFromAccount" placeholder="Paid from account title / wallet / bank account" />
            <Textarea className="md:col-span-3" name="paymentClaimNote" placeholder="Optional note, e.g. screenshot reference or transfer remarks" />
          </form>
          </>
        )}
      </CardContent>
    </Card>
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
