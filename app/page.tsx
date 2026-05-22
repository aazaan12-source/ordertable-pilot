import Link from "next/link";
import { revalidatePath } from "next/cache";
import { ArrowRight, BellRing, CheckCircle2, ClipboardList, QrCode, ReceiptText, ShieldCheck, Smartphone } from "lucide-react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DemoSimulation } from "@/components/public/demo-simulation";
import { appBaseUrl } from "@/lib/site-url";
import { qrDataUrl } from "@/lib/qr";
import { getSoftwareReleasePayload } from "@/lib/software-licensing";

export const dynamic = "force-dynamic";

const heroImage = "https://images.pexels.com/photos/25003368/pexels-photo-25003368.jpeg?auto=compress&cs=tinysrgb&w=1800";
const kitchenImage = "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80";
const tableImage = "https://images.pexels.com/photos/6127315/pexels-photo-6127315.jpeg?auto=compress&cs=tinysrgb&w=1200";

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

export default async function PublicHomePage() {
  const [demoQrCodes, softwareRelease] = await Promise.all([
    Promise.all([1, 2, 3, 4, 5, 6].map(async (tableNumber) => {
      const url = `${appBaseUrl()}/demo/simulation/order?table=${tableNumber}&session=public-demo`;
      return { tableNumber, url, dataUrl: await qrDataUrl(url) };
    })),
    getSoftwareReleasePayload()
  ]);

  return (
    <main className="min-h-screen bg-background">
      <section className="relative min-h-[92vh] overflow-hidden bg-black text-white">
        <img src={heroImage} alt="Restaurant table with assorted dishes" className="absolute inset-0 h-full w-full object-cover opacity-55" />
        <div className="absolute inset-0 bg-black/45" />
        <header className="relative z-10 border-b border-white/15">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
            <Link href="/" className="text-xl font-black">OrderTable</Link>
            <nav className="flex items-center gap-2">
              <Link href="/login"><Button className="bg-white text-black hover:bg-white/90">Sign in</Button></Link>
            </nav>
          </div>
        </header>

        <div className="relative z-10 mx-auto grid max-w-6xl gap-8 px-4 pb-10 pt-16 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="flex flex-col justify-center">
            <p className="w-fit rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wide">QR ordering for real restaurant pilots</p>
            <h1 className="mt-5 max-w-3xl text-5xl font-black leading-tight md:text-6xl">Let guests order from the table while your team runs the floor faster.</h1>
            <p className="mt-5 max-w-2xl text-lg text-white/85">
              A practical QR ordering platform with live manager dashboard, waiter call alerts, kitchen slips, customer bills, restaurant onboarding, and 20-table pilot support.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <div>
                <Link href="/request-restaurant"><Button size="lg" className="bg-white text-black hover:bg-white/90">Request Restaurant Setup</Button></Link>
                <p className="mt-1 text-xs text-white/75">Send your details for account setup.</p>
              </div>
              <div>
                <Link href="#demo-simulation"><Button size="lg" variant="outline" className="border-white/40 bg-white/10 text-white hover:bg-white hover:text-black">Try Live Demo <ArrowRight className="h-5 w-5" /></Button></Link>
                <p className="mt-1 text-xs text-white/75">Place a demo order and manage it live.</p>
              </div>
            </div>
          </div>

          <Card className="bg-white/95 text-foreground shadow-2xl">
            <CardHeader>
              <CardTitle className="text-2xl">Request a restaurant account</CardTitle>
              <p className="text-sm text-muted-foreground">Send your table count and contact details to the platform team.</p>
            </CardHeader>
            <CardContent>
              <form action={submitRestaurantRequest} className="space-y-3">
                <Input name="restaurantName" placeholder="Restaurant name" required />
                <Input name="contactName" placeholder="Owner/contact name" required />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input name="phone" placeholder="Phone / WhatsApp" required />
                  <Input name="city" placeholder="City" required />
                </div>
                <Input name="email" type="email" placeholder="Email optional" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input name="expectedTables" type="number" placeholder="Number of tables" defaultValue={20} />
                  <select name="planInterest" defaultValue="Pilot" className="h-10 w-full rounded-md border bg-white px-3 text-sm">
                    <option value="Pilot">Pilot</option>
                    <option value="Starter">Starter</option>
                    <option value="Growth">Growth</option>
                    <option value="Pro">Pro</option>
                  </select>
                </div>
                <Textarea name="message" placeholder="Branch details, requirements, or best time to call" />
                <Button className="w-full" size="lg">Send Request</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <DemoSimulation qrCodes={demoQrCodes} />
      </section>

      {softwareRelease.available ? (
        <section className="border-y bg-white">
          <div className="mx-auto grid max-w-6xl gap-5 px-4 py-10 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-primary">Desktop manager software</p>
              <h2 className="mt-1 text-3xl font-black">Install OrderTable Manager on your restaurant PC.</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                Download the Windows desktop app for live order management, printer-ready dashboard use, controlled license activation, and update checks from the platform team.
                A license key is required after installation.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">Current version: {softwareRelease.version}. Contact OrderTable after payment to receive your activation key.</p>
            </div>
            <a href={softwareRelease.downloadUrl} className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-bold text-primary-foreground hover:brightness-95">
              Download Installer
            </a>
          </div>
        </section>
      ) : null}

      <section className="mx-auto grid max-w-6xl gap-5 px-4 py-8 md:grid-cols-4">
        <Feature icon={QrCode} title="Table QR Codes" body="Create QR codes for each table and keep the customer flow app-free." />
        <Feature icon={ClipboardList} title="Live Orders" body="New orders arrive automatically with status controls and payment state." />
        <Feature icon={BellRing} title="Waiter Voice Alert" body="Bell and speech alerts tell staff exactly which table needs service." />
        <Feature icon={ReceiptText} title="Print Receipts" body="Print kitchen slips and customer bills for thermal roll printers." />
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-10 lg:grid-cols-2">
        <VisualPanel
          image={kitchenImage}
          label="Operations"
          title="Made for busy restaurant service"
          points={["Kitchen slip printing", "Bill requested workflow", "Manager-side status updates", "Customer cancellation window"]}
        />
        <VisualPanel
          image={tableImage}
          label="Platform"
          title="Central control for many restaurants"
          points={["Restaurant account creation", "Monthly billing records", "Account recovery tools", "Online restaurant requests"]}
        />
      </section>

      <section className="border-y bg-white">
        <div className="mx-auto grid max-w-6xl gap-5 px-4 py-10 md:grid-cols-3">
          <Metric value="6" label="demo tables ready" />
          <Metric value="4s" label="dashboard refresh cycle" />
          <Metric value="3 min" label="default cancellation window" />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <Card>
          <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-primary">Ready to test</p>
              <h2 className="text-2xl font-black">Open the demo restaurant and place a live order.</h2>
              <p className="mt-1 text-sm text-muted-foreground">Open the demo dashboard and scan one of the six demo table QR codes.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="#demo-simulation"><Button>Try Demo Simulation</Button></Link>
            </div>
          </CardContent>
        </Card>
        <Card className="mt-5 border-primary/20 bg-primary/5">
          <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-primary">Restaurant setup</p>
              <h2 className="text-2xl font-black">Want OrderTable implemented in your restaurant?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Send us a restaurant setup request, or contact us directly at <strong>aazaan12gmail.com</strong> or <strong>0302 5635926</strong>.
              </p>
            </div>
            <Link href="/request-restaurant"><Button>Request Restaurant Setup</Button></Link>
          </CardContent>
        </Card>
        <p className="mt-4 text-xs text-muted-foreground">Photos sourced from free stock libraries: Pexels and Unsplash. Replace with real restaurant photos before final commercial launch.</p>
      </section>
    </main>
  );
}

function Feature({ icon: Icon, title, body }: { icon: typeof Smartphone; title: string; body: string }) {
  return (
    <Card>
      <CardHeader>
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent><p className="text-sm text-muted-foreground">{body}</p></CardContent>
    </Card>
  );
}

function VisualPanel({ image, label, title, points }: { image: string; label: string; title: string; points: string[] }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-white">
      <img src={image} alt={title} className="h-64 w-full object-cover" />
      <div className="p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-primary">{label}</p>
        <h2 className="mt-1 text-2xl font-black">{title}</h2>
        <div className="mt-4 grid gap-2">
          {points.map((point) => (
            <p key={point} className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              {point}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border bg-background p-5 text-center">
      <p className="text-4xl font-black text-primary">{value}</p>
      <p className="mt-1 text-sm font-semibold text-muted-foreground">{label}</p>
    </div>
  );
}
