import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getManagerRestaurant } from "@/lib/permissions";
import { PrintPageButton } from "@/components/admin/print-page-button";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatPkDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ManagerInvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { restaurant } = await getManagerRestaurant();
  const { id } = await params;
  const invoice = await db.billingInvoice.findFirst({
    where: { id, restaurantId: restaurant.id, status: { not: "DRAFT" } },
    include: { paymentAccount: true }
  });
  if (!invoice) notFound();
  const accounts = invoice.paymentAccount
    ? [invoice.paymentAccount]
    : await db.billingPaymentAccount.findMany({
        where: { isActive: true, OR: [{ restaurantId: null }, { restaurantId: restaurant.id }] },
        orderBy: [{ restaurantId: "desc" }, { createdAt: "asc" }]
      });

  return (
    <main className="mx-auto max-w-3xl bg-white p-4 text-foreground print:p-0">
      <div className="mb-4 flex gap-2 print:hidden">
        <PrintPageButton label="Print / Save PDF" />
        <Link href="/dashboard/billing"><Button variant="outline">Back to Billing</Button></Link>
      </div>
      <section className="rounded-lg border p-8 print:border-0">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">OrderTable Pilot</p>
            <h1 className="mt-1 text-3xl font-bold">Monthly Billing Invoice</h1>
            <p className="mt-1 text-sm text-muted-foreground">Invoice ID: {invoice.id}</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-bold">{invoice.status}</p>
            <p>Created {formatPkDateTime(invoice.createdAt)}</p>
            {invoice.dueDate ? <p>Due {formatPkDateTime(invoice.dueDate)}</p> : null}
          </div>
        </div>

        <div className="grid gap-6 border-b py-5 sm:grid-cols-2">
          <div>
            <h2 className="font-bold">Bill To</h2>
            <p className="mt-2">{restaurant.name}</p>
            <p>{restaurant.branchName}</p>
            <p>{restaurant.city}</p>
            <p>{restaurant.phone}</p>
          </div>
          <div>
            <h2 className="font-bold">Invoice Details</h2>
            <p className="mt-2">Billing month: <strong>{invoice.billingMonth}</strong></p>
            <p>Plan: <strong>{invoice.planName}</strong></p>
            <p>Amount due: <strong>{formatCurrency(invoice.amount.toString())}</strong></p>
            {invoice.paymentReference ? <p>Reference: <strong>{invoice.paymentReference}</strong></p> : null}
          </div>
        </div>

        <table className="my-5 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted text-left">
              <th className="p-3">Description</th>
              <th className="p-3">Month</th>
              <th className="p-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="p-3">OrderTable Pilot monthly platform fee - {invoice.planName}</td>
              <td className="p-3">{invoice.billingMonth}</td>
              <td className="p-3 text-right font-bold">{formatCurrency(invoice.amount.toString())}</td>
            </tr>
          </tbody>
        </table>

        <div className="grid gap-4 border-t pt-5 sm:grid-cols-2">
          <div>
            <h2 className="font-bold">Payment Instructions</h2>
            {accounts.length > 0 ? (
              <div className="mt-2 space-y-3">
                {accounts.map((account) => (
                  <div key={account.id} className="rounded-md border p-3 text-sm">
                    <p className="font-semibold">{account.label} ({account.method})</p>
                    <p>Account title: {account.accountTitle}</p>
                    <p>Account number: {account.accountNumber}</p>
                    {account.bankName ? <p>Bank: {account.bankName}</p> : null}
                    {account.instructions ? <p className="mt-1 text-muted-foreground">{account.instructions}</p> : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Payment account is not configured yet. Contact Super Admin.</p>
            )}
          </div>
          <div>
            <h2 className="font-bold">Status</h2>
            <p className="mt-2 text-sm text-muted-foreground">{invoice.notes || "Please pay before due date and submit payment reference from the manager dashboard."}</p>
            {invoice.paymentClaimedAt ? <p className="mt-3 text-sm">Payment submitted: {formatPkDateTime(invoice.paymentClaimedAt)}</p> : null}
            {invoice.paidAt ? <p className="mt-3 text-sm font-semibold">Paid and confirmed: {formatPkDateTime(invoice.paidAt)}</p> : null}
          </div>
        </div>
      </section>
    </main>
  );
}
