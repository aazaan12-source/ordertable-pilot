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
  searchParams: Promise<{ template?: string; lead?: string; error?: string }>;
}) {
  await requirePlatformAdmin();
  const { template = "pilot", lead: leadId, error } = await searchParams;
  const selected = templates[template] || templates.pilot;
  const lead = leadId ? await db.platformLead.findUnique({ where: { id: leadId } }) : null;
  const restaurantName = lead?.restaurantName || "";
  const branch = "Main Branch";
  const slugSuggestion = slugifyRestaurant(`${restaurantName}-${branch}-${lead?.city || ""}`) || "";
  const baseUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || "";
  const errorMessages: Record<string, string> = {
    "missing-required-fields": "Please fill restaurant name, slug, city, manager email, and manager password.",
    "password-mismatch": "Manager temporary password and confirmation do not match.",
    "slug-already-exists": "This restaurant URL slug already exists. Please choose another.",
    "manager-email-already-exists": "This manager email already exists. Use a different email or edit the existing manager account.",
    "duplicate-record": "A restaurant, manager, or table with these details already exists. Please change the slug or manager email.",
    "server-error": "The restaurant could not be created because the server/database rejected the request. Check Vercel logs for the printed createRestaurantWithTablesAndManager error."
  };

  return (
    <main className="mx-auto max-w-6xl p-3 sm:p-4 lg:p-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold sm:text-2xl">Add New Restaurant</h1>
        <p className="text-sm text-muted-foreground">Create restaurant details, table QR codes, manager login, and optional sample menu in one clean flow.</p>
      </div>

      {error ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {errorMessages[error] || "Restaurant could not be created. Please check the form and try again."}
        </div>
      ) : null}

      <div className="mb-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {Object.entries(templates).map(([key, item]) => (
          <a key={key} href={`/admin/restaurants/new?template=${key}${leadId ? `&lead=${leadId}` : ""}`} className="rounded-md border bg-white px-3 py-2 text-center text-xs font-semibold hover:bg-muted sm:text-sm">
            {item.label}
          </a>
        ))}
      </div>

      <form action={createRestaurantWithTablesAndManager} className="space-y-5">
        <input type="hidden" name="leadId" value={lead?.id || ""} />

        <StepCard step="Step 1" title="Basic Restaurant Details" description="This information appears in admin, QR flows, receipts, and manager dashboards.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input name="name" placeholder="Restaurant name" defaultValue={restaurantName} required />
            <Input name="branchName" placeholder="Branch name" defaultValue={branch} required />
            <Input name="city" placeholder="City" defaultValue={lead?.city || ""} required />
            <Input name="phone" placeholder="Phone" defaultValue={lead?.phone || ""} />
            <Input name="logoUrl" placeholder="Logo URL optional" />
            <Input className="sm:col-span-2" name="address" placeholder="Location/address" defaultValue="" required />
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

        <StepCard step="Step 2" title="URL Slug" description="This becomes the restaurant's public QR URL. Avoid changing it after QR codes are printed.">
          <Input name="slug" placeholder="restaurant-slug" defaultValue={slugSuggestion} required />
          <p className="mt-2 break-all text-xs text-muted-foreground">
            Customer QR pattern: {baseUrl || "[APP_URL]"}<strong>/r/{slugSuggestion || "restaurant-slug"}/t/[table-number]</strong>
          </p>
          {!baseUrl ? (
            <p className="mt-2 rounded-md border bg-amber-50 p-2 text-xs text-amber-800">
              APP_URL is not set. QR URLs will use relative paths until APP_URL or NEXTAUTH_URL is configured.
            </p>
          ) : null}
        </StepCard>

        <StepCard step="Step 3" title="Tables & QR Codes" description="The system automatically creates one table record and one QR URL for every table number.">
          <div className="grid gap-3 sm:grid-cols-3">
            <Input name="tableCount" type="number" min={1} max={500} defaultValue={lead?.expectedTables || selected.tables} placeholder="Number of tables" required />
            <Input name="startingTableNumber" type="number" min={1} defaultValue={1} placeholder="Starting table number" />
            <Input name="tablePrefix" placeholder="Optional prefix for display only" />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Example: 10 tables from starting number 1 creates table QR links 1 to 10.</p>
        </StepCard>

        <StepCard step="Step 4" title="Restaurant Manager Login" description="The manager will use the same /dashboard interface as the demo restaurant, but only with this restaurant's data.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input name="managerName" placeholder="Manager name" defaultValue={lead?.contactName || ""} required />
            <Input name="managerEmail" type="email" placeholder="Manager email" defaultValue={lead?.email || ""} required />
            <Input name="managerPhone" placeholder="Manager phone optional" defaultValue={lead?.phone || ""} />
            <PasswordInput name="managerPassword" placeholder="Temporary password" defaultValue="Manager12345" required />
            <PasswordInput name="managerPasswordConfirm" placeholder="Confirm temporary password" defaultValue="Manager12345" required />
            <select name="managerIsActive" defaultValue="true" className="h-10 rounded-md border bg-white px-3 text-sm">
              <option value="true">Manager active</option>
              <option value="false">Manager disabled</option>
            </select>
          </div>
        </StepCard>

        <StepCard step="Step 5" title="Initial Menu Setup" description="Start empty or create a sample menu that the restaurant can edit later.">
          <div className="grid gap-3 sm:grid-cols-2">
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

        <StepCard step="Step 6" title="Review and Create" description="After creation, open the restaurant detail page to print QR codes or manage menu.">
          <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <p>Restaurant: <strong className="text-foreground">{restaurantName || "Entered above"}</strong></p>
            <p>Branch: <strong className="text-foreground">{branch}</strong></p>
            <p>Tables: <strong className="text-foreground">{lead?.expectedTables || selected.tables}</strong></p>
            <p>Plan: <strong className="text-foreground">{selected.plan}</strong></p>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            After creation, QR codes are generated and the restaurant manager can immediately log in at <strong className="text-foreground">/dashboard</strong>.
          </p>
          <Button className="mt-4 w-full" size="lg">Create Restaurant</Button>
        </StepCard>
      </form>
    </main>
  );
}

function StepCard({ step, title, description, children }: { step: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-wide text-primary">{step}</p>
        <CardTitle className="text-lg sm:text-xl">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">{children}</CardContent>
    </Card>
  );
}
