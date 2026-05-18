import { AdminNav } from "@/components/admin/admin-nav";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/permissions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformAdmin();
  const billingAlertCount = await db.billingInvoice.count({ where: { paymentClaimedAt: { not: null }, status: { not: "PAID" } } });
  return (
    <div>
      <AdminNav billingAlertCount={billingAlertCount} />
      {children}
    </div>
  );
}
