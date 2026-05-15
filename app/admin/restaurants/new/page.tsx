import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { SubscriptionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/permissions";
import { tableQrUrl } from "@/lib/qr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const templates: Record<string, { label: string; tables: number; plan: SubscriptionStatus; monthlyPrice: number; service: number; tax: number }> = {
  pilot: { label: "Pilot Restaurant", tables: 20, plan: "PILOT", monthlyPrice: 0, service: 0, tax: 0 },
  cafe: { label: "Small Cafe", tables: 10, plan: "STARTER", monthlyPrice: 5000, service: 0, tax: 0 },
  dining: { label: "Full Restaurant", tables: 30, plan: "GROWTH", monthlyPrice: 15000, service: 0, tax: 0 },
  premium: { label: "Premium Multi-Section", tables: 50, plan: "PRO", monthlyPrice: 30000, service: 0, tax: 0 }
};

async function createRestaurant(formData: FormData) {
  "use server";
  const user = await requirePlatformAdmin();
  const slug = String(formData.get("slug") || "").trim().toLowerCase();
  const tableCount = Math.max(1, Number(formData.get("tableCount") || 0));
  const managerEmail = String(formData.get("managerEmail") || "").trim().toLowerCase();
  const managerPassword = String(formData.get("managerPassword") || "Manager12345");
  const subscriptionStatus = String(formData.get("subscriptionStatus") || "PILOT") as SubscriptionStatus;
  const monthlyPrice = Number(formData.get("monthlyPrice") || 0);
  const leadId = String(formData.get("leadId") || "");

  const restaurant = await db.$transaction(async (tx) => {
    const created = await tx.restaurant.create({
      data: {
        name: String(formData.get("name") || ""),
        slug,
        branchName: String(formData.get("branchName") || ""),
        city: String(formData.get("city") || ""),
        address: String(formData.get("address") || ""),
        phone: String(formData.get("phone") || ""),
        status: formData.get("status") === "INACTIVE" ? "INACTIVE" : "ACTIVE",
        subscriptionStatus,
        orderingEnabled: true,
        pilotStartDate: new Date(),
        serviceChargePercent: Number(formData.get("serviceChargePercent") || 0),
        taxPercent: Number(formData.get("taxPercent") || 0),
        customerCancelWindowMinutes: Number(formData.get("customerCancelWindowMinutes") || 3)
      }
    });

    for (let tableNumber = 1; tableNumber <= tableCount; tableNumber++) {
      await tx.restaurantTable.create({ data: { restaurantId: created.id, tableNumber, qrUrl: tableQrUrl(slug, tableNumber) } });
    }

    if (managerEmail) {
      await tx.user.create({
        data: {
          name: String(formData.get("managerName") || "Restaurant Manager"),
          email: managerEmail,
          passwordHash: await bcrypt.hash(managerPassword, 12),
          role: "RESTAURANT_MANAGER",
          restaurantId: created.id
        }
      });
    }

    await tx.subscription.create({
      data: {
        restaurantId: created.id,
        planName: subscriptionStatus,
        monthlyPrice,
        status: "ACTIVE",
        startDate: new Date()
      }
    });

    if (monthlyPrice > 0) {
      await tx.billingInvoice.create({
        data: {
          restaurantId: created.id,
          billingMonth: new Date().toISOString().slice(0, 7),
          planName: subscriptionStatus,
          amount: monthlyPrice,
          status: "DUE"
        }
      });
    }

    if (leadId) {
      await tx.platformLead.update({ where: { id: leadId }, data: { status: "CONVERTED", convertedRestaurantId: created.id } }).catch(() => undefined);
    }

    await tx.activityLog.create({ data: { userId: user.id, restaurantId: created.id, action: "RESTAURANT_CREATED", description: created.name } });
    return created;
  });

  redirect(`/admin/restaurants/${restaurant.id}`);
}

export default async function NewRestaurantPage({
  searchParams
}: {
  searchParams: Promise<{ template?: string; lead?: string }>;
}) {
  await requirePlatformAdmin();
  const { template = "pilot", lead: leadId } = await searchParams;
  const selected = templates[template] || templates.pilot;
  const lead = leadId ? await db.platformLead.findUnique({ where: { id: leadId } }) : null;
  const slugSuggestion = (lead?.restaurantName || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  return (
    <main className="mx-auto max-w-5xl p-4 lg:p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Create Restaurant Account</h1>
        <p className="text-sm text-muted-foreground">Use a template, account request, or phone call details to create a manager account and table QR codes.</p>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {Object.entries(templates).map(([key, item]) => (
          <a key={key} href={`/admin/restaurants/new?template=${key}${leadId ? `&lead=${leadId}` : ""}`} className="rounded-md border bg-white px-3 py-2 text-sm font-semibold hover:bg-muted">
            {item.label}
          </a>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>{selected.label}</CardTitle></CardHeader>
        <CardContent>
          <form action={createRestaurant} className="grid gap-4 md:grid-cols-2">
            <input type="hidden" name="leadId" value={lead?.id || ""} />
            <Input name="name" placeholder="Restaurant name" defaultValue={lead?.restaurantName || ""} required />
            <Input name="slug" placeholder="restaurant-slug" defaultValue={slugSuggestion} required />
            <Input name="branchName" placeholder="Branch" defaultValue="Main Branch" required />
            <Input name="city" placeholder="City" defaultValue={lead?.city || ""} required />
            <Input className="md:col-span-2" name="address" placeholder="Address" required />
            <Input name="phone" placeholder="Phone" defaultValue={lead?.phone || ""} required />
            <Input name="tableCount" type="number" placeholder="Tables" defaultValue={lead?.expectedTables || selected.tables} />
            <select name="subscriptionStatus" defaultValue={selected.plan} className="h-10 rounded-md border bg-white px-3 text-sm">
              <option value="PILOT">PILOT</option>
              <option value="STARTER">STARTER</option>
              <option value="GROWTH">GROWTH</option>
              <option value="PRO">PRO</option>
            </select>
            <Input name="monthlyPrice" type="number" placeholder="Monthly platform fee" defaultValue={selected.monthlyPrice} />
            <Input name="serviceChargePercent" type="number" placeholder="Service charge %" defaultValue={selected.service} />
            <Input name="taxPercent" type="number" placeholder="Tax %" defaultValue={selected.tax} />
            <Input name="customerCancelWindowMinutes" type="number" placeholder="Cancel window minutes" defaultValue={3} />
            <Input name="managerName" placeholder="Manager name" defaultValue={lead?.contactName || "Restaurant Manager"} />
            <Input name="managerEmail" type="email" placeholder="Manager email" defaultValue={lead?.email || ""} />
            <Input name="managerPassword" placeholder="Manager password" defaultValue="Manager12345" />
            <Textarea className="md:col-span-2" name="notes" placeholder="Internal onboarding notes" defaultValue={lead?.message || ""} />
            <Button className="md:col-span-2">Create Restaurant Account</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
