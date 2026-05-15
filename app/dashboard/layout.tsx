import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { ManagerAlerts } from "@/components/dashboard/manager-alerts";
import { getManagerRestaurant } from "@/lib/permissions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { restaurant } = await getManagerRestaurant();
  return (
    <div className="lg:flex">
      <DashboardNav restaurantName={restaurant.name} />
      <div className="min-w-0 flex-1">{children}</div>
      <ManagerAlerts />
    </div>
  );
}
