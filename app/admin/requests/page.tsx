import Link from "next/link";
import { revalidatePath } from "next/cache";
import { LeadStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPkDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function updateLeadStatus(formData: FormData) {
  "use server";
  const user = await requirePlatformAdmin();
  const id = String(formData.get("id"));
  const status = String(formData.get("status")) as LeadStatus;
  const current = await db.platformLead.findUnique({ where: { id } });
  if (!current || current.status === "CONVERTED" || current.convertedRestaurantId) {
    revalidatePath("/admin/requests");
    return;
  }
  await db.platformLead.update({ where: { id }, data: { status } });
  await db.activityLog.create({ data: { userId: user.id, action: "PLATFORM_LEAD_UPDATED", description: `Lead ${id} changed to ${status}` } });
  revalidatePath("/admin/requests");
}

export default async function AdminRequestsPage() {
  await requirePlatformAdmin();
  const leads = await db.platformLead.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <main className="mx-auto max-w-6xl p-4 lg:p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Restaurant Account Requests</h1>
        <p className="text-sm text-muted-foreground">Requests submitted from the public website or received by phone can be tracked here.</p>
      </div>
      <div className="grid gap-4">
        {leads.map((lead) => {
          const converted = lead.status === "CONVERTED" || Boolean(lead.convertedRestaurantId);
          return (
          <Card key={lead.id} className={converted ? "bg-muted/40" : ""}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>{lead.restaurantName}</CardTitle>
                  <p className="text-sm text-muted-foreground">{lead.contactName} · {lead.phone} · {lead.city}</p>
                  <p className="text-xs text-muted-foreground">{formatPkDateTime(lead.createdAt)}</p>
                </div>
                <span className="rounded-md bg-muted px-3 py-1 text-sm font-semibold">{lead.status}</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 text-sm md:grid-cols-4">
                <p>Email: <strong>{lead.email || "Not provided"}</strong></p>
                <p>Tables: <strong>{lead.expectedTables}</strong></p>
                <p>Plan: <strong>{lead.planInterest || "Pilot"}</strong></p>
                <p>Source: <strong>{lead.source}</strong></p>
              </div>
              {lead.message ? <p className="mt-3 rounded-md border p-3 text-sm">{lead.message}</p> : null}
              {converted ? (
                <div className="mt-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                  This request has already been converted and is now read-only.
                  {lead.convertedRestaurantId ? (
                    <Link className="ml-2 font-bold underline" href={`/admin/restaurants/${lead.convertedRestaurantId}`}>Open restaurant</Link>
                  ) : null}
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  <form action={updateLeadStatus} className="flex gap-2">
                    <input type="hidden" name="id" value={lead.id} />
                    <select name="status" defaultValue={lead.status} className="h-10 rounded-md border bg-white px-3 text-sm">
                      <option value="NEW">NEW</option>
                      <option value="CONTACTED">CONTACTED</option>
                      <option value="CLOSED">CLOSED</option>
                    </select>
                    <Button variant="outline">Update</Button>
                  </form>
                  <Link href={`/admin/restaurants/new?lead=${lead.id}`}>
                    <Button>Create Account From Request</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
          );
        })}
      </div>
      {leads.length === 0 ? <p className="rounded-md border bg-white p-6 text-center text-muted-foreground">No account requests yet.</p> : null}
    </main>
  );
}
