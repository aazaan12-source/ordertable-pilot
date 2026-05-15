import { AdminNav } from "@/components/admin/admin-nav";
import { requirePlatformAdmin } from "@/lib/permissions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformAdmin();
  return (
    <div>
      <AdminNav />
      {children}
    </div>
  );
}
