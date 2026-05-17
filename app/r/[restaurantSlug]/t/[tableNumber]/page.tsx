import { notFound } from "next/navigation";
import { RestaurantStatus, TableStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { OrderMenu } from "@/components/customer/order-menu";
import { RecentOrderLink } from "@/components/customer/recent-order-link";
import { RequestButtons } from "@/components/customer/request-buttons";
import { safeStoredImageUrl } from "@/lib/menu-images";

export const dynamic = "force-dynamic";

export default async function CustomerTablePage({
  params
}: {
  params: Promise<{ restaurantSlug: string; tableNumber: string }>;
}) {
  const { restaurantSlug, tableNumber } = await params;
  const tableNo = Number(tableNumber);
  if (!Number.isInteger(tableNo) || tableNo < 1) notFound();

  let restaurant;
  try {
    restaurant = await db.restaurant.findUnique({
      where: { slug: restaurantSlug },
      include: {
        tables: { where: { tableNumber: tableNo } },
        categories: { where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        menuItems: {
          where: { isActive: true, isAvailable: true },
          include: { category: true },
          orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { createdAt: "asc" }]
        }
      }
    });
  } catch (error) {
    console.error("customer table load failed", error);
    return <Message title="Setup issue" body="The ordering system cannot reach the database right now. Please ask the restaurant staff for help." />;
  }

  if (!restaurant) return <Message title="Restaurant not found" body="This QR code does not match an active restaurant." />;
  if (restaurant.status !== RestaurantStatus.ACTIVE) return <Message title="Restaurant inactive" body="This restaurant is not accepting online orders right now." />;
  if (restaurant.tables.length === 0) return <Message title="Invalid table QR code" body="Please ask the restaurant staff for help." />;
  if (restaurant.tables[0].status === TableStatus.INACTIVE) return <Message title="Table inactive" body="This table QR is currently inactive. Please contact restaurant staff." />;
  if (!restaurant.orderingEnabled) return <Message title="Ordering paused" body="Online ordering is temporarily paused. Please call the waiter." />;

  return (
    <>
      <div className="mx-auto max-w-5xl px-4 pt-4">
        <RecentOrderLink restaurantSlug={restaurant.slug} tableNumber={tableNo} />
      </div>
      <OrderMenu
        restaurant={{
          name: restaurant.name,
          slug: restaurant.slug,
          logoUrl: restaurant.logoUrl,
          branchName: restaurant.branchName,
          city: restaurant.city,
          serviceChargePercent: restaurant.serviceChargePercent.toString(),
          taxPercent: restaurant.taxPercent.toString()
        }}
        tableNumber={tableNo}
        categories={restaurant.categories.map((category) => ({ id: category.id, name: category.name, imageUrl: safeStoredImageUrl(category.imageUrl) }))}
        items={restaurant.menuItems.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          price: item.price.toString(),
          imageUrl: safeStoredImageUrl(item.imageUrl),
          category: { id: item.category.id, name: item.category.name }
        }))}
      />
      <div className="mx-auto max-w-5xl px-4 pb-44 sm:pb-28">
        <RequestButtons restaurantSlug={restaurant.slug} tableNumber={tableNo} pinnedMobile />
      </div>
    </>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-sm rounded-lg border bg-white p-6 text-center">
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="mt-2 text-muted-foreground">{body}</p>
      </div>
    </main>
  );
}
