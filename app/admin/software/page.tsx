import { revalidatePath } from "next/cache";
import { SoftwareLicenseStatus } from "@prisma/client";
import { AdminBreadcrumbs } from "@/components/admin/admin-breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/confirm-submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/permissions";
import {
  defaultSoftwareDownloadUrl,
  generateSoftwareLicenseKey,
  keyPreview,
  softwareCurrentVersion,
  softwareDefaultInstallerName
} from "@/lib/software-licensing";
import { formatPkDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

function text(formData: FormData, key: string, fallback = "") {
  return String(formData.get(key) || fallback).trim();
}

async function createSoftwareRelease(formData: FormData) {
  "use server";
  const admin = await requirePlatformAdmin();
  const publishNow = text(formData, "isPublished") === "true";
  if (publishNow) {
    await db.softwareRelease.updateMany({ where: { isPublished: true }, data: { isPublished: false } });
  }
  const release = await db.softwareRelease.create({
    data: {
      version: text(formData, "version", softwareCurrentVersion),
      title: text(formData, "title", "OrderTable Manager Desktop"),
      downloadUrl: text(formData, "downloadUrl", defaultSoftwareDownloadUrl()),
      fileName: text(formData, "fileName", softwareDefaultInstallerName) || null,
      checksum: text(formData, "checksum") || null,
      minSupportedVersion: text(formData, "minSupportedVersion") || null,
      releaseNotes: text(formData, "releaseNotes") || null,
      isPublished: publishNow
    }
  });
  await db.activityLog.create({ data: { userId: admin.id, action: "SOFTWARE_RELEASE_CREATED", description: `${release.version} software release created${publishNow ? " and published" : ""}` } });
  revalidatePath("/admin/software");
  revalidatePath("/");
}

async function publishRelease(formData: FormData) {
  "use server";
  const admin = await requirePlatformAdmin();
  const id = text(formData, "id");
  await db.$transaction([
    db.softwareRelease.updateMany({ where: { isPublished: true }, data: { isPublished: false } }),
    db.softwareRelease.update({ where: { id }, data: { isPublished: true } }),
    db.activityLog.create({ data: { userId: admin.id, action: "SOFTWARE_RELEASE_PUBLISHED", description: `Software release ${id} published` } })
  ]);
  revalidatePath("/admin/software");
  revalidatePath("/");
}

async function createSoftwareLicense(formData: FormData) {
  "use server";
  const admin = await requirePlatformAdmin();
  const licenseKey = generateSoftwareLicenseKey();
  const restaurantId = text(formData, "restaurantId") || null;
  const license = await db.softwareLicense.create({
    data: {
      restaurantId,
      clientName: text(formData, "clientName"),
      contactName: text(formData, "contactName") || null,
      contactEmail: text(formData, "contactEmail") || null,
      contactPhone: text(formData, "contactPhone") || null,
      licenseKey,
      keyPreview: keyPreview(licenseKey),
      maxDevices: Math.max(1, Number(formData.get("maxDevices") || 1)),
      expiresAt: formData.get("expiresAt") ? new Date(String(formData.get("expiresAt"))) : null,
      notes: text(formData, "notes") || null,
      createdById: admin.id
    }
  });
  await db.activityLog.create({ data: { userId: admin.id, restaurantId, action: "SOFTWARE_LICENSE_CREATED", description: `${license.clientName} license created: ${license.keyPreview}` } });
  revalidatePath("/admin/software");
}

async function updateLicenseStatus(formData: FormData) {
  "use server";
  const admin = await requirePlatformAdmin();
  const id = text(formData, "id");
  const status = text(formData, "status") as SoftwareLicenseStatus;
  const license = await db.softwareLicense.update({ where: { id }, data: { status } });
  await db.activityLog.create({ data: { userId: admin.id, restaurantId: license.restaurantId, action: "SOFTWARE_LICENSE_STATUS_UPDATED", description: `${license.keyPreview} changed to ${status}` } });
  revalidatePath("/admin/software");
}

async function deactivateLicenseDevice(formData: FormData) {
  "use server";
  const admin = await requirePlatformAdmin();
  const id = text(formData, "id");
  const device = await db.softwareLicenseDevice.update({ where: { id }, data: { isActive: false } });
  await db.activityLog.create({ data: { userId: admin.id, action: "SOFTWARE_LICENSE_DEVICE_DEACTIVATED", description: `Device ${device.deviceId} deactivated` } });
  revalidatePath("/admin/software");
}

export default async function AdminSoftwarePage() {
  await requirePlatformAdmin();
  const [restaurants, releases, licenses, recentValidations] = await Promise.all([
    db.restaurant.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, branchName: true } }),
    db.softwareRelease.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    db.softwareLicense.findMany({
      include: { restaurant: true, devices: { orderBy: { lastValidatedAt: "desc" } } },
      orderBy: { createdAt: "desc" },
      take: 50
    }),
    db.softwareLicenseValidation.findMany({
      include: { license: { select: { clientName: true, keyPreview: true } } },
      orderBy: { createdAt: "desc" },
      take: 20
    })
  ]);
  const activeLicenses = licenses.filter((license) => license.status === "ACTIVE").length;
  const publishedRelease = releases.find((release) => release.isPublished);

  return (
    <main className="mx-auto max-w-7xl p-4 lg:p-6">
      <AdminBreadcrumbs items={[{ label: "Software" }]} />
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Software Control</h1>
        <p className="text-sm text-muted-foreground">Publish the Windows desktop installer, create paid license keys, and control activation for restaurant clients.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat title="Published Version" value={publishedRelease?.version || "None"} note={publishedRelease ? "Visible on public website" : "Publish a release first"} />
        <Stat title="Total Licenses" value={licenses.length} note="Latest 50 shown below" />
        <Stat title="Active Licenses" value={activeLicenses} note="Allowed to operate desktop app" />
        <Stat title="Validation Logs" value={recentValidations.length} note="Recent desktop app checks" />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Publish Installer Release</CardTitle>
            <p className="text-sm text-muted-foreground">The published release appears on the public homepage download section and in desktop update checks.</p>
          </CardHeader>
          <CardContent>
            <form action={createSoftwareRelease} className="grid gap-3 md:grid-cols-2">
              <Input name="version" defaultValue={softwareCurrentVersion} placeholder="Version" required />
              <Input name="title" defaultValue="OrderTable Manager Desktop" placeholder="Release title" required />
              <Input className="md:col-span-2" name="downloadUrl" defaultValue={defaultSoftwareDownloadUrl()} placeholder="Download URL" required />
              <Input name="fileName" defaultValue={softwareDefaultInstallerName} placeholder="Installer file name" />
              <Input name="minSupportedVersion" placeholder="Minimum supported version optional" />
              <Input className="md:col-span-2" name="checksum" placeholder="SHA/checksum optional" />
              <Textarea className="md:col-span-2" name="releaseNotes" placeholder="Release notes visible to customers and desktop app" />
              <label className="flex items-center gap-2 rounded-md border p-3 text-sm md:col-span-2">
                <input type="checkbox" name="isPublished" value="true" />
                Publish this release now
              </label>
              <SubmitButton className="md:col-span-2" pendingText="Saving release...">Save Release</SubmitButton>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Create Client License Key</CardTitle>
            <p className="text-sm text-muted-foreground">Give this key only after payment or approval. Super Admin can suspend it later.</p>
          </CardHeader>
          <CardContent>
            <form action={createSoftwareLicense} className="grid gap-3 md:grid-cols-2">
              <select name="restaurantId" className="h-10 rounded-md border bg-white px-3 text-sm">
                <option value="">No restaurant linked yet</option>
                {restaurants.map((restaurant) => <option key={restaurant.id} value={restaurant.id}>{restaurant.name} - {restaurant.branchName}</option>)}
              </select>
              <Input name="clientName" placeholder="Client / restaurant buyer name" required />
              <Input name="contactName" placeholder="Contact person" />
              <Input name="contactPhone" placeholder="Phone / WhatsApp" />
              <Input name="contactEmail" type="email" placeholder="Email optional" />
              <Input name="maxDevices" type="number" min={1} defaultValue={1} placeholder="Allowed PCs" />
              <Input name="expiresAt" type="date" />
              <Textarea className="md:col-span-2" name="notes" placeholder="Payment terms, invoice reference, or internal notes" />
              <SubmitButton className="md:col-span-2" pendingText="Creating key...">Create License Key</SubmitButton>
            </form>
          </CardContent>
        </Card>
      </div>

      <section className="mt-6 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>License Keys</CardTitle>
            <p className="text-sm text-muted-foreground">Keys are shown here for provisioning. Treat them like passwords.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {licenses.map((license) => (
              <div key={license.id} className="rounded-md border bg-white p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{license.clientName} <span className={statusClass(license.status)}>{license.status}</span></p>
                    <p className="text-muted-foreground">{license.restaurant ? `${license.restaurant.name} - ${license.restaurant.branchName}` : "No restaurant linked"}</p>
                    <p className="mt-2 rounded-md border bg-muted/30 p-2 font-mono text-xs break-all">{license.licenseKey}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Allowed PCs: {license.maxDevices} - Active devices: {license.devices.filter((device) => device.isActive).length} - Created {formatPkDateTime(license.createdAt)}</p>
                    {license.lastValidatedAt ? <p className="text-xs text-muted-foreground">Last checked {formatPkDateTime(license.lastValidatedAt)}</p> : null}
                    {license.expiresAt ? <p className="text-xs text-muted-foreground">Expires {formatPkDateTime(license.expiresAt)}</p> : null}
                  </div>
                  <form action={updateLicenseStatus} className="flex gap-2">
                    <input type="hidden" name="id" value={license.id} />
                    <select name="status" defaultValue={license.status} className="h-10 rounded-md border bg-white px-3 text-sm">
                      <option value="ACTIVE">Active</option>
                      <option value="SUSPENDED">Suspended</option>
                      <option value="EXPIRED">Expired</option>
                    </select>
                    <SubmitButton pendingText="Saving...">Save</SubmitButton>
                  </form>
                </div>
                {license.devices.length > 0 ? (
                  <div className="mt-3 grid gap-2">
                    {license.devices.map((device) => (
                      <div key={device.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/20 p-2 text-xs">
                        <div>
                          <p className="font-semibold">{device.deviceName || "Desktop PC"} <span className={device.isActive ? "text-green-700" : "text-red-700"}>{device.isActive ? "Active" : "Inactive"}</span></p>
                          <p className="text-muted-foreground">{device.platform || "Unknown platform"} - {device.deviceId}</p>
                          <p className="text-muted-foreground">Last checked {formatPkDateTime(device.lastValidatedAt)}</p>
                        </div>
                        {device.isActive ? (
                          <form action={deactivateLicenseDevice}>
                            <input type="hidden" name="id" value={device.id} />
                            <Button variant="outline" size="sm">Deactivate PC</Button>
                          </form>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            {licenses.length === 0 ? <p className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">No software licenses yet.</p> : null}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Installer Releases</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {releases.map((release) => (
                <div key={release.id} className="rounded-md border bg-white p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">{release.version} {release.isPublished ? <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] text-green-800">Published</span> : null}</p>
                      <p className="text-muted-foreground">{release.title}</p>
                      <p className="break-all text-xs text-muted-foreground">{release.downloadUrl}</p>
                    </div>
                    {!release.isPublished ? (
                      <form action={publishRelease}>
                        <input type="hidden" name="id" value={release.id} />
                        <Button size="sm" variant="outline">Publish</Button>
                      </form>
                    ) : null}
                  </div>
                </div>
              ))}
              {releases.length === 0 ? <p className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">No installer release has been published yet.</p> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent License Checks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentValidations.map((validation) => (
                <div key={validation.id} className="rounded-md border bg-white p-3 text-xs">
                  <p className="font-bold">{validation.status}: {validation.message}</p>
                  <p className="text-muted-foreground">{validation.license?.clientName || validation.licenseKeyPreview || "Unknown key"} - {validation.deviceId || "No device"}</p>
                  <p className="text-muted-foreground">{formatPkDateTime(validation.createdAt)}</p>
                </div>
              ))}
              {recentValidations.length === 0 ? <p className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">No desktop validation checks yet.</p> : null}
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}

function statusClass(status: SoftwareLicenseStatus) {
  if (status === "ACTIVE") return "ml-2 rounded-full bg-green-100 px-2 py-0.5 text-[11px] text-green-800";
  if (status === "SUSPENDED") return "ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[11px] text-red-800";
  return "ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700";
}

function Stat({ title, value, note }: { title: string; value: React.ReactNode; note: string }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm text-muted-foreground">{title}</CardTitle></CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  );
}
