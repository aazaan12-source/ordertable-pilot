import Link from "next/link";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const dynamic = "force-dynamic";

async function submitRestaurantRequest(formData: FormData) {
  "use server";
  const restaurantName = String(formData.get("restaurantName") || "").trim();
  const contactName = String(formData.get("contactName") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const city = String(formData.get("city") || "").trim();
  if (!restaurantName || !contactName || !phone || !city) return;

  await db.platformLead.create({
    data: {
      restaurantName,
      contactName,
      phone,
      city,
      email: String(formData.get("email") || "").trim() || null,
      expectedTables: Math.max(1, Number(formData.get("expectedTables") || 20)),
      planInterest: String(formData.get("planInterest") || "Pilot"),
      message: String(formData.get("message") || "").trim() || null,
      source: "WEBSITE"
    }
  });
  revalidatePath("/");
}

export default function PublicHomePage() {
  return (
    <main className="min-h-screen bg-background">
      <section className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">OrderTable Pilot</p>
            <h1 className="text-2xl font-black">QR table ordering for restaurants</h1>
          </div>
          <div className="flex gap-2">
            <Link href="/login"><Button variant="outline">Login</Button></Link>
            <Link href="/r/demo-restaurant-islamabad/t/1"><Button>Demo Menu</Button></Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          <div>
            <h2 className="text-4xl font-black leading-tight">Take table orders, print kitchen slips, and track restaurant billing from one platform.</h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Customers scan a table QR code, place orders from their phone, call the waiter, request bills, and managers receive everything live in the restaurant dashboard.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Feature title="20+ Tables" body="Generate table QR codes and manage live table activity." />
            <Feature title="Kitchen Ready" body="Print roll-printer kitchen slips and customer bills." />
            <Feature title="Super Admin" body="Create restaurant accounts, track invoices, and recover logins." />
          </div>

          <Card>
            <CardHeader><CardTitle>Contact super admin</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Phone: 03000000000</p>
              <p>Email: support@ordertable.pk</p>
              <p>Restaurant owners can request a new account using the form. The platform admin will contact you and configure your tables, manager login, and monthly billing.</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Request restaurant account</CardTitle>
            <p className="text-sm text-muted-foreground">This request appears inside the super-admin panel.</p>
          </CardHeader>
          <CardContent>
            <form action={submitRestaurantRequest} className="space-y-3">
              <Input name="restaurantName" placeholder="Restaurant name" required />
              <Input name="contactName" placeholder="Owner/contact name" required />
              <Input name="phone" placeholder="Phone / WhatsApp" required />
              <Input name="email" type="email" placeholder="Email optional" />
              <Input name="city" placeholder="City" required />
              <Input name="expectedTables" type="number" placeholder="Number of tables" defaultValue={20} />
              <select name="planInterest" defaultValue="Pilot" className="h-10 w-full rounded-md border bg-white px-3 text-sm">
                <option value="Pilot">Pilot</option>
                <option value="Starter">Starter</option>
                <option value="Growth">Growth</option>
                <option value="Pro">Pro</option>
              </select>
              <Textarea name="message" placeholder="Requirements, branch details, or best time to call" />
              <Button className="w-full">Send Request</Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent><p className="text-sm text-muted-foreground">{body}</p></CardContent>
    </Card>
  );
}
