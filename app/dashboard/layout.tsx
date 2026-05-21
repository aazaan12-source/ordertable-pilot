import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { ManagerAlerts } from "@/components/dashboard/manager-alerts";
import { NetworkStatus } from "@/components/dashboard/network-status";
import { db } from "@/lib/db";
import { getManagerRestaurant } from "@/lib/permissions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { restaurant } = await getManagerRestaurant();
  const remindedInvoices = await db.billingInvoice.findMany({
    where: {
      restaurantId: restaurant.id,
      status: { in: ["DUE", "OVERDUE"] },
      paymentClaimedAt: null,
      paymentReminderAt: { not: null }
    },
    select: { paymentReminderAt: true, paymentReminderSeenAt: true }
  });
  const billingAlertCount = remindedInvoices.filter((invoice) => {
    if (!invoice.paymentReminderAt) return false;
    return !invoice.paymentReminderSeenAt || invoice.paymentReminderSeenAt < invoice.paymentReminderAt;
  }).length;
  return (
    <div className="lg:flex">
      <DashboardNav restaurantName={restaurant.name} billingAlertCount={billingAlertCount} />
      <div className="min-w-0 flex-1">{children}</div>
      <NetworkStatus />
      <ManagerAlerts />
    </div>
  );
}
