import Link from "next/link";
import { getManagerRestaurant } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { FinancialPrivacyToggle } from "@/components/dashboard/financial-privacy-toggle";
import { DashboardOverviewStats } from "@/components/dashboard/dashboard-overview-stats";
import { getDashboardSummary } from "@/lib/dashboard-live-data";

export const dynamic = "force-dynamic";

export default async function DashboardHome() {
  const { restaurant } = await getManagerRestaurant();
  const summary = await getDashboardSummary(restaurant.id);

  return (
    <main className="p-4 lg:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Today at {restaurant.name}</h1>
          <p className="text-sm text-muted-foreground">Quick view for restaurant staff.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <FinancialPrivacyToggle />
          <Link href="/dashboard/orders"><Button>Open Live Orders</Button></Link>
        </div>
      </div>
      <DashboardOverviewStats initialSummary={summary} />
    </main>
  );
}
