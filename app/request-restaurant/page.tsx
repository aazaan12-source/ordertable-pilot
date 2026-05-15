import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const dynamic = "force-dynamic";

async function submitOnboardingRequest(formData: FormData) {
  "use server";
  const restaurantName = String(formData.get("restaurantName") || "").trim();
  const contactName = String(formData.get("contactName") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const city = String(formData.get("city") || "").trim();
  const address = String(formData.get("address") || "").trim();
  const message = String(formData.get("message") || "").trim();
  const approximateTables = Math.max(1, Number(formData.get("approximateTables") || 1));
  if (!restaurantName || !contactName || !phone || !city) return;
  await db.platformLead.create({
    data: {
      restaurantName,
      contactName,
      phone,
      city,
      email: String(formData.get("email") || "").trim() || null,
      expectedTables: approximateTables,
      planInterest: "Pilot",
      message: [address ? `Address: ${address}` : "", message].filter(Boolean).join("\n") || null,
      source: "PUBLIC_REQUEST_PAGE"
    }
  });
  await db.activityLog.create({ data: { action: "ONBOARDING_REQUEST_CREATED", description: `${restaurantName} requested setup from ${city}` } });
  redirect("/request-restaurant?success=1");
}

export default async function RequestRestaurantPage({
  searchParams
}: {
  searchParams: Promise<{ success?: string }>;
}) {
  const { success } = await searchParams;
  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-semibold text-primary">Back to website</Link>
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-2xl">Request Restaurant Setup</CardTitle>
            <p className="text-sm text-muted-foreground">Tell us about your restaurant and table count. Our team will contact you to create your account and QR codes.</p>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="rounded-lg border border-green-300 bg-green-50 p-5 text-green-900">
                <h1 className="font-bold">Your request has been received.</h1>
                <p className="mt-1 text-sm">Our team will contact you soon.</p>
              </div>
            ) : (
              <form action={submitOnboardingRequest} className="grid gap-3 md:grid-cols-2">
                <Input name="restaurantName" placeholder="Restaurant name" required />
                <Input name="contactName" placeholder="Owner/manager name" required />
                <Input name="phone" placeholder="Phone / WhatsApp" required />
                <Input name="email" type="email" placeholder="Email optional" />
                <Input name="city" placeholder="City" required />
                <Input name="approximateTables" type="number" min={1} placeholder="Approximate tables" required />
                <Input className="md:col-span-2" name="address" placeholder="Location/address" />
                <Textarea className="md:col-span-2" name="message" placeholder="Message optional" />
                <Button className="md:col-span-2" size="lg">Submit Request</Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
