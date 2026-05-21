"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, CreditCard, LayoutDashboard, Menu, PlusCircle, QrCode, ReceiptText, Settings, Table2, Bell, Users } from "lucide-react";

const links = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/orders", label: "Live Orders", icon: ClipboardList },
  { href: "/dashboard/orders/new", label: "Create Manual Order", icon: PlusCircle },
  { href: "/dashboard/tables", label: "Tables", icon: Table2 },
  { href: "/dashboard/menu/categories", label: "Categories", icon: Menu },
  { href: "/dashboard/menu/items", label: "Menu Items", icon: Menu },
  { href: "/dashboard/qr-codes", label: "QR Codes", icon: QrCode },
  { href: "/dashboard/waiter-requests", label: "Requests", icon: Bell },
  { href: "/dashboard/waiters", label: "Waiters", icon: Users },
  { href: "/dashboard/reports", label: "Reports", icon: ReceiptText },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/settings", label: "Settings", icon: Settings }
];

export function DashboardNav({ restaurantName, billingAlertCount = 0 }: { restaurantName: string; billingAlertCount?: number }) {
  const pathname = usePathname();
  return (
    <aside className="no-print border-b bg-white lg:min-h-screen lg:w-64 lg:border-b-0 lg:border-r">
      <div className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Manager</p>
        <h2 className="font-bold">{restaurantName}</h2>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:block lg:space-y-1">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Link key={link.href} href={link.href} className="flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
              <Icon className="h-4 w-4" />
              {link.label}
              {link.href === "/dashboard/billing" && billingAlertCount > 0 && pathname !== "/dashboard/billing" ? (
                <span className="ml-auto rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">{billingAlertCount}</span>
              ) : null}
            </Link>
          );
        })}
        <Link href="/api/auth/signout" className="flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
          Logout
        </Link>
      </nav>
    </aside>
  );
}
