import Link from "next/link";
import { BellRing, ChefHat, ClipboardList, Eye, Printer, ReceiptText, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

const demoOrders = [
  {
    order: "ORD-0015",
    table: 7,
    status: "Preparing",
    total: 1650,
    items: ["2 x Zinger Burger - No mayo", "1 x Mint Margarita - Without ice"]
  },
  {
    order: "ORD-0016",
    table: 12,
    status: "Pending",
    total: 2300,
    items: ["1 x Full Chicken Karahi", "2 x Fresh Lime"]
  },
  {
    order: "ORD-0017",
    table: 3,
    status: "Bill Requested",
    total: 950,
    items: ["1 x Beef Burger", "1 x Pepsi"]
  }
];

export default function PublicDashboardDemoPage() {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Read-only training demo</p>
            <h1 className="text-2xl font-black">Manager Dashboard Preview</h1>
          </div>
          <div className="flex gap-2">
            <Link href="/"><Button variant="outline">Back</Button></Link>
            <Link href="/login?demo=manager"><Button>Manager Login</Button></Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-6">
        <div className="rounded-lg border border-orange-300 bg-orange-50 p-4 text-orange-950">
            <p className="font-bold">This is only a training preview.</p>
            <p className="mt-1 text-sm">Visitors can see how the dashboard works, but they cannot edit menu items, change orders, or access real restaurant data from this page.</p>
            <p className="mt-2 text-xs">Small grey notes under each operation explain what the real manager can do after login.</p>
          </div>

        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <Stat title="Live orders" value="3" />
          <Stat title="Today revenue" value={formatCurrency(4900)} />
          <Stat title="Tables active" value="3 / 20" />
          <Stat title="Bill requests" value="1" />
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            {demoOrders.map((order) => (
              <Card key={order.order}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle>{order.order} - Table {order.table}</CardTitle>
                      <p className="text-sm text-muted-foreground">Example live order card</p>
                    </div>
                    <span className="rounded-md bg-primary/10 px-3 py-1 text-sm font-bold text-primary">{order.status}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {order.items.map((item) => <p key={item} className="rounded-md bg-muted p-2 text-sm">{item}</p>)}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-lg font-black">{formatCurrency(order.total)}</p>
                    <div className="flex flex-wrap gap-2">
                      <DemoAction icon={Printer} label="Kitchen Slip" hint="Prints a prep slip in the real dashboard." />
                      <DemoAction icon={ReceiptText} label="Customer Bill" hint="Prints the guest receipt after bill request." />
                      <DemoAction icon={Eye} label="Next Status" hint="Managers move orders from pending to served." primary />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle>What managers can do</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <Feature icon={ClipboardList} text="Receive new orders automatically." />
                <Feature icon={Printer} text="Print kitchen slips and customer bills." />
                <Feature icon={BellRing} text="Hear waiter call alerts by table number." />
                <Feature icon={Settings} text="Manage menu, tables, reports, and settings." />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Kitchen workflow</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <Feature icon={ChefHat} text="Accept order." />
                <Feature icon={ChefHat} text="Move to preparing." />
                <Feature icon={ChefHat} text="Mark ready and served." />
                <Feature icon={ReceiptText} text="Print bill and mark paid." />
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </main>
  );
}

function Stat({ title, value }: { title: string; value: React.ReactNode }) {
  return <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">{title}</CardTitle></CardHeader><CardContent><p className="text-2xl font-black">{value}</p></CardContent></Card>;
}

function Feature({ icon: Icon, text }: { icon: typeof ClipboardList; text: string }) {
  return (
    <p className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-primary" />
      {text}
    </p>
  );
}

function DemoAction({
  icon: Icon,
  label,
  hint,
  primary = false
}: {
  icon: typeof Printer;
  label: string;
  hint: string;
  primary?: boolean;
}) {
  return (
    <div className="max-w-[180px]">
      <Button variant={primary ? "default" : "outline"} disabled>
        <Icon className="h-4 w-4" /> {label}
      </Button>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{hint}</p>
    </div>
  );
}
