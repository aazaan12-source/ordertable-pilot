import Link from "next/link";
import { Bell, Minus, Plus, ReceiptText, ShoppingCart, Smartphone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

const menuItems = [
  {
    name: "Zinger Burger",
    description: "Crispy chicken fillet, lettuce, house sauce, soft bun.",
    price: 650,
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80"
  },
  {
    name: "Chicken Karahi",
    description: "Fresh tomato gravy, ginger, green chilli, served hot.",
    price: 1800,
    image: "https://images.pexels.com/photos/12737913/pexels-photo-12737913.jpeg?auto=compress&cs=tinysrgb&w=800"
  },
  {
    name: "Mint Margarita",
    description: "Cold mint lemon drink for dine-in service.",
    price: 350,
    image: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80"
  }
];

const subtotal = 1650;

export default function PublicCustomerDemoPage() {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Read-only customer training demo</p>
            <h1 className="text-2xl font-black">What guests see after scanning a QR code</h1>
          </div>
          <Link href="/"><Button variant="outline">Back</Button></Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-6">
        <div className="rounded-lg border border-orange-300 bg-orange-50 p-4 text-orange-950">
          <p className="font-bold">This public page is only for learning.</p>
          <p className="mt-1 text-sm">Buttons are disabled so visitors can understand the ordering flow without placing a real order or changing restaurant records.</p>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[220px_1fr_340px]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-base">Categories</CardTitle>
              <p className="text-xs text-muted-foreground">Guests use this left menu to jump quickly between food sections.</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {["Burgers", "Karahi", "Drinks", "Desserts"].map((category, index) => (
                <button
                  key={category}
                  disabled
                  className={`w-full rounded-md border px-3 py-2 text-left text-sm font-semibold ${index === 0 ? "border-primary bg-primary/10 text-primary" : "bg-white text-muted-foreground"}`}
                >
                  {category}
                </button>
              ))}
              <p className="text-[11px] leading-snug text-muted-foreground">Read-only demo: category buttons show navigation style only.</p>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-primary">Demo Restaurant Islamabad</p>
              <h2 className="text-2xl font-black">Table 7 ordering preview</h2>
              <p className="text-sm text-muted-foreground">A real guest can browse menu photos, prices, descriptions, and availability from their own table QR link.</p>
            </div>

            {menuItems.map((item) => (
              <Card key={item.name}>
                <CardContent className="grid gap-4 p-4 sm:grid-cols-[132px_1fr]">
                  <img src={item.image} alt={item.name} className="h-32 w-full rounded-md object-cover sm:w-32" />
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-black">{item.name}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                      </div>
                      <p className="font-black">{formatCurrency(item.price)}</p>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <DemoButton icon={Plus} label="Add" hint="Real guests add this item to cart." />
                      <DemoButton icon={Minus} label="Qty" hint="Quantity can be changed before placing order." />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><ShoppingCart className="h-4 w-4" /> Cart preview</CardTitle>
              <p className="text-xs text-muted-foreground">Guests see the bill estimate before sending the order.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">2 x Zinger Burger</p>
                    <p className="text-xs text-muted-foreground">Note: No mayo</p>
                  </div>
                  <p className="font-bold">{formatCurrency(1300)}</p>
                </div>
                <div className="mt-2 flex gap-2">
                  <DemoButton icon={Plus} label="+" hint="Increase quantity." compact />
                  <DemoButton icon={Minus} label="-" hint="Decrease quantity." compact />
                  <DemoButton icon={Trash2} label="Remove" hint="Remove item from cart." compact />
                </div>
              </div>

              <BillLine label="Subtotal" value={subtotal} />
              <BillLine label="Service Charges" value={0} />
              <BillLine label="Tax" value={0} />
              <div className="border-t pt-3">
                <BillLine label="Estimated Total" value={subtotal} strong />
              </div>

              <DemoButton icon={ShoppingCart} label="Place Order" hint="Disabled here. Real QR pages submit orders to the manager dashboard." full />
              <DemoButton icon={Bell} label="Call Waiter" hint="Real guests can call waiter from their table." full outline />
              <DemoButton icon={ReceiptText} label="Ask for Bill" hint="Shown after active orders are ready or served." full outline />
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-primary">For restaurant owners</p>
              <h2 className="text-xl font-black">Real testing is available after setup.</h2>
              <p className="mt-1 text-sm text-muted-foreground">The live QR order pages remain available for pilot testing, but the public website now uses this read-only training view.</p>
            </div>
            <Link href="/login?demo=manager"><Button variant="outline">Manager Login</Button></Link>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function DemoButton({
  icon: Icon,
  label,
  hint,
  full = false,
  outline = false,
  compact = false
}: {
  icon: typeof Plus;
  label: string;
  hint: string;
  full?: boolean;
  outline?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={full ? "w-full" : compact ? "max-w-[120px]" : "max-w-[180px]"}>
      <Button className={full ? "w-full" : ""} size={compact ? "sm" : "md"} variant={outline ? "outline" : "default"} disabled>
        <Icon className="h-4 w-4" /> {label}
      </Button>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{hint}</p>
    </div>
  );
}

function BillLine({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between text-sm ${strong ? "font-black" : ""}`}>
      <span>{label}</span>
      <span>{formatCurrency(value)}</span>
    </div>
  );
}
