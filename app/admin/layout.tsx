import { AdminNav } from "@/components/admin/admin-nav";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/permissions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformAdmin();
  const billingNotifications = await db.billingInvoice.findMany({
    where: { paymentClaimedAt: { not: null }, status: { not: "PAID" } },
    select: { paymentClaimedAt: true, paymentClaimSeenAt: true }
  });
  const billingAlertCount = billingNotifications.filter((invoice) => (
    invoice.paymentClaimedAt && (!invoice.paymentClaimSeenAt || invoice.paymentClaimSeenAt < invoice.paymentClaimedAt)
  )).length;
  return (
    <div>
      <AdminNav billingAlertCount={billingAlertCount} />
      {children}
    </div>
  );
}
