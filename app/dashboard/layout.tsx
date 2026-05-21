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
      status: { not: "DRAFT" },
      OR: [
        { status: { in: ["DUE", "OVERDUE", "WAIVED"] } },
        { paymentReminderAt: { not: null } },
        { paymentRejectedAt: { not: null } },
        { paymentConfirmedAt: { not: null } }
      ]
    },
    select: {
      status: true,
      createdAt: true,
      invoiceSeenAt: true,
      paymentReminderAt: true,
      paymentReminderSeenAt: true,
      paymentRejectedAt: true,
      paymentRejectionSeenAt: true,
      paymentConfirmedAt: true,
      paymentConfirmationSeenAt: true
    }
  });
  const billingAlertCount = billingNotifications.filter((invoice) => {
    const unseenInvoice = (invoice.status === "DUE" || invoice.status === "OVERDUE" || invoice.status === "WAIVED") && (!invoice.invoiceSeenAt || invoice.invoiceSeenAt < invoice.createdAt);
    const unseenReminder = invoice.paymentReminderAt && (!invoice.paymentReminderSeenAt || invoice.paymentReminderSeenAt < invoice.paymentReminderAt);
    const unseenRejection = invoice.paymentRejectedAt && (!invoice.paymentRejectionSeenAt || invoice.paymentRejectionSeenAt < invoice.paymentRejectedAt);
    const unseenConfirmation = invoice.paymentConfirmedAt && (!invoice.paymentConfirmationSeenAt || invoice.paymentConfirmationSeenAt < invoice.paymentConfirmedAt);
    return unseenInvoice || unseenReminder || unseenRejection || unseenConfirmation;
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
