import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { ManagerAlerts } from "@/components/dashboard/manager-alerts";
import { NetworkStatus } from "@/components/dashboard/network-status";
import { db } from "@/lib/db";
import { getManagerRestaurant } from "@/lib/permissions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { restaurant } = await getManagerRestaurant();
  const billingNotifications = await db.billingInvoice.findMany({
    where: {
      restaurantId: restaurant.id,
      status: { in: ["DUE", "OVERDUE"] },
      OR: [
        { paymentClaimedAt: null, paymentReminderAt: { not: null } },
        { paymentRejectedAt: { not: null } }
      ]
    },
    select: { paymentReminderAt: true, paymentReminderSeenAt: true, paymentRejectedAt: true, paymentRejectionSeenAt: true }
  });
  const billingAlertCount = billingNotifications.filter((invoice) => {
    const unseenReminder = invoice.paymentReminderAt && (!invoice.paymentReminderSeenAt || invoice.paymentReminderSeenAt < invoice.paymentReminderAt);
    const unseenRejection = invoice.paymentRejectedAt && (!invoice.paymentRejectionSeenAt || invoice.paymentRejectionSeenAt < invoice.paymentRejectedAt);
    return unseenReminder || unseenRejection;
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
