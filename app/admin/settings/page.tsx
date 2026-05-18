import Link from "next/link";
import { AdminBreadcrumbs } from "@/components/admin/admin-breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminSettingsPage() {
  return (
    <main className="mx-auto max-w-5xl p-4 lg:p-6">
      <AdminBreadcrumbs items={[{ label: "Settings" }]} />
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Platform Settings</h1>
        <p className="text-sm text-muted-foreground">System-level settings and operational links for the Super Admin area.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Billing</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Open the existing billing area for platform invoices and subscription billing records.</p>
            <Link href="/admin/billing"><Button variant="outline">Open Billing</Button></Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Restaurant Setup</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Restaurant-specific settings are managed inside each Restaurant Control Center.</p>
            <Link href="/admin/restaurants"><Button>Choose Restaurant</Button></Link>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

