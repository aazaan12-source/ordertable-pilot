import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderStatus, RestaurantStatus, TableStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { OrderMenu } from "@/components/customer/order-menu";
import { RecentOrderLink } from "@/components/customer/recent-order-link";
import { RequestButtons } from "@/components/customer/request-buttons";
import { safeStoredImageUrl } from "@/lib/menu-images";
import { sortMenuItemsForDisplay } from "@/lib/menu-ordering";
import { orderSourceLabel, orderStatusLabels } from "@/lib/order-utils";
import { tableQrUrl } from "@/lib/qr";
import { appBaseUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

const publicSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function generateMetadata({
  params
}: {
  params: Promise<{ restaurantSlug: string; tableNumber: string }>;
}): Promise<Metadata> {
  const { restaurantSlug, tableNumber } = await params;
  const tableNo = Number(tableNumber);
  if (!publicSlugPattern.test(restaurantSlug) || !Number.isInteger(tableNo) || tableNo < 1 || tableNo > 500) {
    return { title: "OrderTable" };
  }

  const restaurant = await db.restaurant.findUnique({
    where: { slug: restaurantSlug },
    select: { name: true, branchName: true, city: true }
  });
  const title = restaurant ? `${restaurant.name} Table ${tableNo} Order` : `Table ${tableNo} Order`;
  return {
    title,
    description: restaurant
      ? `Open the menu and place an order for table ${tableNo} at ${restaurant.name}, ${restaurant.branchName}.`
      : `Open the menu and place an order for table ${tableNo}.`,
    alternates: {
      canonical: `${appBaseUrl()}${tableQrUrl(restaurantSlug, tableNo)}`
    },
    robots: {
      index: true,
      follow: true
    }
  };
}

export default async function CustomerTablePage({
  params
}: {
  params: Promise<{ restaurantSlug: string; tableNumber: string }>;
}) {
  const { restaurantSlug, tableNumber } = await params;
  const tableNo = Number(tableNumber);
  if (!publicSlugPattern.test(restaurantSlug) || !Number.isInteger(tableNo) || tableNo < 1 || tableNo > 500) notFound();

  let restaurant;
  try {
    restaurant = await db.restaurant.findUnique({
      where: { slug: restaurantSlug },
      include: {
        tables: { where: { tableNumber: tableNo } },
        waiters: { where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
        categories: { where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        menuItems: {
          where: { isActive: true, isAvailable: true },
          include: { category: true },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
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

  const activeStatuses: OrderStatus[] = ["PENDING", "ACCEPTED", "PREPARING", "READY", "SERVED", "BILL_REQUESTED"];
  // These two reads are independent, so run them concurrently to save a round-trip
  // on this high-traffic customer page.
  const [activeOrder, globalWaiters] = await Promise.all([
    db.order.findFirst({
      where: {
        restaurantId: restaurant.id,
        tableId: restaurant.tables[0].id,
        status: { in: activeStatuses },
        paymentStatus: { not: "PAID" }
      },
      include: { items: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "desc" }
    }),
    db.restaurantWaiter.findMany({
      where: { isActive: true },
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true }
    })
  ]);
  const waiterOptions = Array.from(
    new Map(globalWaiters.map((waiter) => [waiter.name.toLocaleLowerCase(), waiter])).values()
  );

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
        waiterOptions={waiterOptions.map((waiter) => ({ id: waiter.id, name: waiter.name }))}
        items={sortMenuItemsForDisplay(restaurant.menuItems).map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          price: item.price.toString(),
          imageUrl: safeStoredImageUrl(item.imageUrl),
          category: { id: item.category.id, name: item.category.name }
        }))}
        activeOrder={activeOrder ? {
          id: activeOrder.id,
          orderNumber: activeOrder.orderNumber,
          status: activeOrder.status,
          statusLabel: orderStatusLabels[activeOrder.status],
          sourceLabel: orderSourceLabel(activeOrder.source),
          customerName: activeOrder.customerName,
          waiterName: activeOrder.waiterName,
          total: activeOrder.total.toString(),
          items: activeOrder.items.map((item) => ({
            id: item.id,
            itemName: item.itemName,
            quantity: item.quantity,
            totalPrice: item.totalPrice.toString(),
            specialInstruction: item.specialInstruction
          }))
        } : null}
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
