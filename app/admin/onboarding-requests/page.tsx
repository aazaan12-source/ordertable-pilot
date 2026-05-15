import Link from "next/link";
import { LeadStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/permissions";
import { updateOnboardingLeadStatus } from "@/lib/admin-restaurant-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatPkDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminOnboardingRequestsPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; status?: LeadStatus }>;
}) {
  await requirePlatformAdmin();
  const filters = await searchParams;
  const leads = await db.platformLead.findMany({
    where: {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.q
        ? {
            OR: [
              { restaurantName: { contains: filters.q, mode: "insensitive" } },
              { city: { contains: filters.q, mode: "insensitive" } },
              { phone: { contains: filters.q, mode: "insensitive" } }
            ]
          }
        : {})
    },
    orderBy: { createdAt: "desc" }
  });

  return (
    <main className="mx-auto max-w-6xl p-4 lg:p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Onboarding Requests</h1>
        <p className="text-sm text-muted-foreground">Restaurant owners submit these from the public website. Convert approved requests into active restaurant accounts.</p>
      </div>

      <Card className="mb-5">
        <CardContent className="p-4">
          <form className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
            <Input name="q" placeholder="Search restaurant, city, phone" defaultValue={filters.q || ""} />
            <select name="status" defaultValue={filters.status || ""} className="h-10 rounded-md border bg-white px-3 text-sm">
              <option value="">All statuses</option>
              <option value="NEW">New</option>
              <option value="CONTACTED">Contacted</option>
              <option value="CONVERTED">Converted</option>
              <option value="CLOSED">Closed / rejected</option>
            </select>
            <Button variant="outline">Filter</Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {leads.map((lead) => (
          <Card key={lead.id}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>{lead.restaurantName}</CardTitle>
                  <p className="text-sm text-muted-foreground">{lead.contactName} · {lead.phone} · {lead.city}</p>
                  <p className="text-xs text-muted-foreground">{formatPkDateTime(lead.createdAt)}</p>
                </div>
                <Badge className={lead.status === "NEW" ? "bg-orange-100 text-orange-800" : "bg-muted text-foreground"}>{lead.status}</Badge>
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
              <div className="mt-4 flex flex-wrap gap-2">
                <form action={updateOnboardingLeadStatus} className="flex gap-2">
                  <input type="hidden" name="id" value={lead.id} />
                  <select name="status" defaultValue={lead.status} className="h-10 rounded-md border bg-white px-3 text-sm">
                    <option value="NEW">NEW</option>
                    <option value="CONTACTED">CONTACTED</option>
                    <option value="CONVERTED">CONVERTED</option>
                    <option value="CLOSED">CLOSED / REJECTED</option>
                  </select>
                  <Button variant="outline">Update</Button>
                </form>
                <Link href={`/admin/restaurants/new?lead=${lead.id}`}>
                  <Button>Convert to Restaurant</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {leads.length === 0 ? <p className="rounded-lg border bg-white p-6 text-center text-muted-foreground">No onboarding requests found.</p> : null}
    </main>
  );
}
