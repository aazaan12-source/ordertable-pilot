import Link from "next/link";

export type AdminBreadcrumb = {
  label: string;
  href?: string;
};

export function AdminBreadcrumbs({ items }: { items: AdminBreadcrumb[] }) {
  return (
    <nav className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
      <Link href="/admin" className="hover:text-foreground">Admin</Link>
      {items.map((item) => (
        <span key={`${item.label}-${item.href || "current"}`} className="flex items-center gap-2">
          <span>/</span>
          {item.href ? <Link href={item.href} className="hover:text-foreground">{item.label}</Link> : <span className="text-foreground">{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}

