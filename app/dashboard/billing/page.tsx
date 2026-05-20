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

      <div className="mt-6 grid gap-4">
        {invoices.map((invoice) => {
          const pendingConfirmation = Boolean(invoice.paymentClaimedAt && invoice.status !== "PAID");
          const rejectedPayment = Boolean(invoice.paymentRejectedAt && invoice.status !== "PAID");
          const selectedAccount = invoice.paymentAccount || accounts[0];
          return (
            <Card key={invoice.id} className={invoice.status === "PAID" ? "bg-green-50/40" : pendingConfirmation ? "border-blue-300 bg-blue-50/40" : rejectedPayment ? "border-red-300 bg-red-50/40" : ""}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{invoice.billingMonth} Monthly Invoice</p>
                    <p className="text-sm text-muted-foreground">{invoice.planName} - {formatCurrency(invoice.amount.toString())} - {invoice.status}</p>
                    <p className="text-xs text-muted-foreground">Created {formatPkDateTime(invoice.createdAt)}{invoice.dueDate ? ` - Due ${formatPkDateTime(invoice.dueDate)}` : ""}</p>
                  </div>
                  <Link href={`/dashboard/billing/${invoice.id}/print`}><Button variant="outline">PDF / Print</Button></Link>
                </div>

                {invoice.notes ? <p className="mt-3 rounded-md border p-3 text-sm text-muted-foreground">{invoice.notes}</p> : null}
                {selectedAccount ? (
                  <div className="mt-3 rounded-md border bg-white p-3 text-sm">
                    <p className="font-semibold">Suggested payment account</p>
                    <p>{selectedAccount.label} - {selectedAccount.method}</p>
                    <p>{selectedAccount.accountTitle} - {selectedAccount.accountNumber}</p>
                    {selectedAccount.bankName ? <p>{selectedAccount.bankName}</p> : null}
                  </div>
                ) : null}

                {invoice.status === "PAID" ? (
                  <div className="mt-3 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                    Paid and confirmed by platform billing{invoice.paidAt ? ` on ${formatPkDateTime(invoice.paidAt)}` : ""}.
                  </div>
                ) : invoice.status === "WAIVED" ? (
                  <div className="mt-3 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
                    This invoice has been waived by platform billing. No payment action is required.
                  </div>
                ) : pendingConfirmation ? (
                  <div className="mt-3 rounded-md border border-blue-200 bg-white p-3 text-sm text-blue-900">
                    Payment submitted by manager. Waiting for platform billing confirmation.
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
                    <Textarea className="md:col-span-3" name="paymentClaimNote" placeholder="Optional note, e.g. paid from account title or screenshot reference" />
                  </form>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
        {invoices.length === 0 ? <p className="rounded-lg border bg-white p-6 text-center text-muted-foreground">No monthly billing invoices yet.</p> : null}
      </div>
    </main>
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
