import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { OrderMenu } from "@/components/customer/order-menu";
import { safeStoredImageUrl } from "@/lib/menu-images";

export default async function EditOrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      table: true,
      restaurant: {
        include: {
          categories: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
          menuItems: {
            where: { isActive: true, isAvailable: true },
            include: { category: true },
            orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }]
          }
        }
      }
    }
  });
  if (!order) notFound();

  if (order.status !== "PENDING") {
    return (
      <main className="mx-auto max-w-md px-4 py-10 text-center">
        <h1 className="text-2xl font-bold">Order already accepted</h1>
        <p className="mt-2 text-muted-foreground">This order can only be edited before the restaurant accepts it.</p>
      </main>
    );
  }

  return (
    <OrderMenu
      restaurant={{ name: order.restaurant.name, slug: order.restaurant.slug, logoUrl: order.restaurant.logoUrl }}
      tableNumber={order.table.tableNumber}
      categories={order.restaurant.categories.map((category) => ({ id: category.id, name: category.name, imageUrl: safeStoredImageUrl(category.imageUrl) }))}
      items={order.restaurant.menuItems.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price.toString(),
        imageUrl: safeStoredImageUrl(item.imageUrl),
        category: { id: item.category.id, name: item.category.name }
      }))}
      editOrder={{
        id: order.id,
        orderNumber: order.orderNumber,
        specialNote: order.specialNote,
        items: order.items
          .filter((item) => item.menuItemId)
          .map((item) => ({
            menuItemId: item.menuItemId!,
            itemName: item.itemName,
            unitPrice: item.unitPrice.toString(),
            quantity: item.quantity,
            specialInstruction: item.specialInstruction
          }))
      }}
    />
  );
}
