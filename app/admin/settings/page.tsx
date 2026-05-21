import Link from "next/link";
import { revalidatePath } from "next/cache";
import { AdminBreadcrumbs } from "@/components/admin/admin-breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/confirm-submit-button";
import { maskEmail, maskPhone, normalizeRecoveryEmail, normalizeRecoveryPhone } from "@/lib/admin-recovery";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/permissions";

async function updateSuperAdminRecoveryContacts(formData: FormData) {
  "use server";
  const admin = await requirePlatformAdmin();
  const recoveryEmail = normalizeRecoveryEmail(formData.get("recoveryEmail")) || null;
  const recoveryPhone = normalizeRecoveryPhone(formData.get("recoveryPhone")) || null;

  await db.$transaction([
    db.user.update({
      where: { id: admin.id },
      data: { recoveryEmail, recoveryPhone }
    }),
    db.activityLog.create({
      data: {
        userId: admin.id,
        action: "SUPER_ADMIN_RECOVERY_CONTACTS_UPDATED",
        description: "Platform admin recovery email/mobile settings updated"
      }
    })
  ]);
  revalidatePath("/admin/settings");
}

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const admin = await requirePlatformAdmin();
  const billingNotifications = await db.billingInvoice.findMany({
    where: { paymentClaimedAt: { not: null }, status: { not: "PAID" } },
    select: { paymentClaimedAt: true, paymentClaimSeenAt: true }
  });
  const billingAlertCount = billingNotifications.filter((invoice) => (
    invoice.paymentClaimedAt && (!invoice.paymentClaimSeenAt || invoice.paymentClaimSeenAt < invoice.paymentClaimedAt)
  )).length;
  const adminUser = await db.user.findUnique({
    where: { id: admin.id },
    select: { recoveryEmail: true, recoveryPhone: true, email: true }
  });
  return (
    <main className="mx-auto max-w-5xl p-4 lg:p-6">
      <AdminBreadcrumbs items={[{ label: "Settings" }]} />
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Platform Settings</h1>
        <p className="text-sm text-muted-foreground">System-level settings and operational links for the Super Admin area.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Billing
              {billingAlertCount > 0 ? <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">{billingAlertCount}</span> : null}
            </CardTitle>
          </CardHeader>
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
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Super Admin Login Recovery</CardTitle>
            <p className="text-sm text-muted-foreground">Control the alternate email and mobile number used if the platform admin login ID or password is forgotten.</p>
          </CardHeader>
          <CardContent>
            <form action={updateSuperAdminRecoveryContacts} className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Alternate recovery email</label>
                <Input name="recoveryEmail" type="email" placeholder="owner@example.com" defaultValue={adminUser?.recoveryEmail || ""} />
                <p className="mt-1 text-xs text-muted-foreground">Current: {maskEmail(adminUser?.recoveryEmail)}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Recovery mobile number</label>
                <Input name="recoveryPhone" placeholder="+923001234567" defaultValue={adminUser?.recoveryPhone || ""} />
                <p className="mt-1 text-xs text-muted-foreground">Current: {maskPhone(adminUser?.recoveryPhone)}</p>
              </div>
              <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground md:col-span-2">
                Login email controlled here: <strong className="text-foreground">{adminUser?.email}</strong>. Password resets are done through OTP at <strong className="text-foreground">/super-admin-login/recover</strong>.
              </div>
              <SubmitButton className="md:col-span-2" pendingText="Saving recovery settings...">Save Recovery Contacts</SubmitButton>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
