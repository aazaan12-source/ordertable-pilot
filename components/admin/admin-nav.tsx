import Link from "next/link";

export function AdminNav() {
  return (
    <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-3 py-3 sm:px-4">
        <div className="flex items-center justify-between gap-3">
          <Link href="/admin" className="text-sm font-black sm:text-base">OrderTable Super Admin</Link>
          <Link href="/admin/restaurants/new" className="rounded-md bg-primary px-3 py-2 text-xs font-bold text-primary-foreground sm:hidden">
            Add Restaurant
          </Link>
        </div>
        <nav className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-semibold sm:flex sm:flex-wrap sm:items-center sm:gap-3 sm:text-left sm:text-sm">
          <Link href="/" className="rounded-md border px-2 py-2 hover:bg-muted sm:border-0 sm:px-0">Website</Link>
          <Link href="/admin" className="rounded-md border px-2 py-2 hover:bg-muted sm:border-0 sm:px-0">Overview</Link>
          <Link href="/admin/restaurants" className="rounded-md border px-2 py-2 hover:bg-muted sm:border-0 sm:px-0">Restaurants</Link>
          <Link href="/admin/onboarding-requests" className="rounded-md border px-2 py-2 hover:bg-muted sm:border-0 sm:px-0">Requests</Link>
          <Link href="/admin/billing" className="rounded-md border px-2 py-2 hover:bg-muted sm:border-0 sm:px-0">Billing</Link>
          <Link href="/admin/restaurants/new" className="hidden rounded-md border px-2 py-2 hover:bg-muted sm:block sm:border-0 sm:px-0">New Restaurant</Link>
          <Link href="/admin/logout" className="rounded-md border px-2 py-2 hover:bg-muted sm:border-0 sm:px-0">Logout</Link>
        </nav>
      </div>
    </header>
  );
}
