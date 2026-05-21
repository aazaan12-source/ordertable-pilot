import Link from "next/link";

const links = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/restaurants", label: "Restaurants" },
  { href: "/admin/restaurants/new", label: "Add Restaurant" },
  { href: "/admin/onboarding-requests", label: "Onboarding Requests" },
  { href: "/admin/billing", label: "Billing" },
  { href: "/admin/reports", label: "Platform Reports" },
  { href: "/admin/settings", label: "Settings" }
];

export function AdminNav({ billingAlertCount = 0 }: { billingAlertCount?: number }) {
  return (
    <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-3 py-3 sm:px-4">
        <div className="flex items-center justify-between gap-3">
          <Link href="/admin" className="text-sm font-black sm:text-base">OrderTable Super Admin</Link>
          <Link href="/admin/logout" className="rounded-md border px-3 py-2 text-xs font-bold hover:bg-muted">Logout</Link>
        </div>
        <nav className="mt-3 flex gap-2 overflow-x-auto pb-1 text-xs font-semibold sm:flex-wrap sm:overflow-visible sm:text-sm">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="whitespace-nowrap rounded-md border px-3 py-2 hover:bg-muted">
              {link.label}
              {link.href === "/admin/billing" && billingAlertCount > 0 ? (
                <span className="ml-2 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">{billingAlertCount}</span>
              ) : null}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
