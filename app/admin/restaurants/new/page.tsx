import { SubscriptionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/permissions";
import { createRestaurantWithTablesAndManager } from "@/lib/admin-restaurant-actions";
import { slugifyRestaurant } from "@/lib/admin-restaurant-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PasswordInput } from "@/components/ui/password-input";

export const dynamic = "force-dynamic";

const templates: Record<string, { label: string; tables: number; plan: SubscriptionStatus; price: number }> = {
  pilot: { label: "Pilot Restaurant", tables: 20, plan: "PILOT", price: 0 },
  cafe: { label: "Small Cafe", tables: 10, plan: "STARTER", price: 5000 },
  dining: { label: "Full Restaurant", tables: 30, plan: "GROWTH", price: 15000 },
  premium: { label: "Premium Multi-Section", tables: 50, plan: "PRO", price: 30000 }
};

export default async function NewRestaurantPage({
  searchParams
}: {
  searchParams: Promise<{ template?: string; lead?: string }>;
}) {
  await requirePlatformAdmin();
  const { template = "pilot", lead: leadId } = await searchParams;
  const selected = templates[template] || templates.pilot;
  const lead = leadId ? await db.platformLead.findUnique({ where: { id: leadId } }) : null;
  const restaurantName = lead?.restaurantName || "";
  const branch = "Main Branch";
  const slugSuggestion = slugifyRestaurant(`${restaurantName}-${lead?.city || ""}`) || "";

  return (
    <main className="mx-auto max-w-6xl p-4 lg:p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Add New Restaurant</h1>
        <p className="text-sm text-muted-foreground">Create restaurant details, table QR codes, manager login, and optional sample menu in one clean flow.</p>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {Object.entries(templates).map(([key, item]) => (
          <a key={key} href={`/admin/restaurants/new?template=${key}${leadId ? `&lead=${leadId}` : ""}`} className="rounded-md border bg-white px-3 py-2 text-sm font-semibold hover:bg-muted">
            {item.label}
          </a>
        ))}
      </div>

      <form action={createRestaurantWithTablesAndManager} className="space-y-5">
        <input type="hidden" name="leadId" value={lead?.id || ""} />

        <StepCard step="Step 1" title="Basic Restaurant Details" description="This information appears in admin, QR flows, receipts, and manager dashboards.">
          <div className="grid gap-3 md:grid-cols-2">
            <Input name="name" placeholder="Restaurant name" defaultValue={restaurantName} required />
            <Input name="slug" placeholder="restaurant-slug" defaultValue={slugSuggestion} required />
            <Input name="branchName" placeholder="Branch name" defaultValue={branch} required />
            <Input name="city" placeholder="City" defaultValue={lead?.city || ""} required />
            <Input name="phone" placeholder="Phone" defaultValue={lead?.phone || ""} />
            <Input name="logoUrl" placeholder="Logo URL optional" />
            <Input className="md:col-span-2" name="address" placeholder="Location/address" defaultValue="" required />
            <select name="status" defaultValue="ACTIVE" className="h-10 rounded-md border bg-white px-3 text-sm">
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            <select name="orderingEnabled" defaultValue="true" className="h-10 rounded-md border bg-white px-3 text-sm">
              <option value="true">Ordering enabled</option>
              <option value="false">Ordering disabled</option>
            </select>
            <select name="subscriptionStatus" defaultValue={selected.plan} className="h-10 rounded-md border bg-white px-3 text-sm">
              <option value="PILOT">Pilot</option>
              <option value="STARTER">Starter</option>
              <option value="GROWTH">Growth</option>
              <option value="PRO">Pro</option>
              <option value="EXPIRED">Expired</option>
            </select>
            <Input name="monthlyPrice" type="number" defaultValue={selected.price} placeholder="Monthly platform fee" />
            <Input name="pilotStartDate" type="date" />
            <Input name="pilotEndDate" type="date" />
            <Input name="serviceChargePercent" type="number" defaultValue={0} placeholder="Service charge %" />
            <Input name="taxPercent" type="number" defaultValue={0} placeholder="Tax %" />
            <Input name="customerCancelWindowMinutes" type="number" defaultValue={3} placeholder="Customer cancel window minutes" />
          </div>
        </StepCard>

        <StepCard step="Step 2" title="Tables & QR Codes" description="The system automatically creates one table record and one QR URL for every table number.">
          <div className="grid gap-3 md:grid-cols-3">
            <Input name="tableCount" type="number" min={1} max={500} defaultValue={lead?.expectedTables || selected.tables} placeholder="Number of tables" required />
            <Input name="startingTableNumber" type="number" min={1} defaultValue={1} placeholder="Starting table number" />
            <Input name="tablePrefix" placeholder="Optional prefix for display only" />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Example: 10 tables from starting number 1 creates table QR links 1 to 10.</p>
        </StepCard>

        <StepCard step="Step 3" title="Restaurant Manager Login" description="The manager will only be able to access this restaurant's dashboard.">
          <div className="grid gap-3 md:grid-cols-2">
            <Input name="managerName" placeholder="Manager name" defaultValue={lead?.contactName || ""} required />
            <Input name="managerEmail" type="email" placeholder="Manager email" defaultValue={lead?.email || ""} required />
            <Input name="managerPhone" placeholder="Manager phone optional" defaultValue={lead?.phone || ""} />
            <PasswordInput name="managerPassword" placeholder="Temporary password" defaultValue="Manager12345" required />
            <select name="managerIsActive" defaultValue="true" className="h-10 rounded-md border bg-white px-3 text-sm">
              <option value="true">Manager active</option>
              <option value="false">Manager disabled</option>
            </select>
          </div>
        </StepCard>

        <StepCard step="Step 4" title="Initial Menu Setup" description="Start empty or create a sample menu that the restaurant can edit later.">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="rounded-lg border p-4">
              <input type="radio" name="menuSetup" value="empty" defaultChecked /> <strong>Empty menu</strong>
              <p className="mt-1 text-sm text-muted-foreground">Create categories and items manually after restaurant setup.</p>
            </label>
            <label className="rounded-lg border p-4">
              <input type="radio" name="menuSetup" value="sample" /> <strong>Sample menu</strong>
              <p className="mt-1 text-sm text-muted-foreground">Create Burgers, Pizza, BBQ, Karahi, Drinks, and Desserts with sample items.</p>
            </label>
          </div>
          <Textarea className="mt-3" name="notes" placeholder="Internal onboarding notes optional" defaultValue={lead?.message || ""} />
        </StepCard>

        <StepCard step="Step 5" title="Review and Create" description="After creation, open the restaurant detail page to print QR codes or manage menu.">
          <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
            <p>Restaurant: <strong className="text-foreground">{restaurantName || "Entered above"}</strong></p>
            <p>Branch: <strong className="text-foreground">{branch}</strong></p>
            <p>Tables: <strong className="text-foreground">{lead?.expectedTables || selected.tables}</strong></p>
            <p>Plan: <strong className="text-foreground">{selected.plan}</strong></p>
          </div>
          <Button className="mt-4 w-full" size="lg">Create Restaurant</Button>
        </StepCard>
      </form>
    </main>
  );
}

function StepCard({ step, title, description, children }: { step: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <p className="text-xs font-bold uppercase tracking-wide text-primary">{step}</p>
        <CardTitle>{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
