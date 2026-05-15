import Link from "next/link";

export function AdminNav() {
  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/admin" className="font-bold">OrderTable Super Admin</Link>
        <nav className="flex flex-wrap items-center gap-4 text-sm font-medium">
          <Link href="/">Website</Link>
          <Link href="/admin">Overview</Link>
          <Link href="/admin/restaurants">Restaurants</Link>
          <Link href="/admin/onboarding-requests">Onboarding</Link>
          <Link href="/admin/billing">Billing</Link>
          <Link href="/admin/restaurants/new">New Restaurant</Link>
          <Link href="/admin/logout">Logout</Link>
        </nav>
      </div>
    </header>
  );
}
