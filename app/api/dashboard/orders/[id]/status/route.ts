import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { OrderStatus, PaymentMethod } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/permissions";
import { nextTableStatusAfterClosing, paymentStatusForOrderStatus, tableStatusByOrder } from "@/lib/order-utils";

const schema = z.object({
  status: z.nativeEnum(OrderStatus),
  paymentMethod: z.nativeEnum(PaymentMethod).optional().nullable()
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "RESTAURANT_MANAGER" || !user.restaurantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid status" }, { status: 400 });

    const order = await db.order.findFirst({ where: { id, restaurantId: user.restaurantId } });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.status === "PAID" || order.status === "CANCELLED") {
      return NextResponse.json({ error: "This order is closed." }, { status: 409 });
    }

    const nextStatus = parsed.data.status;
    const updated = await db.$transaction(async (tx) => {
      const result = await tx.order.update({
        where: { id },
        data: {
          status: nextStatus,
          paymentStatus: paymentStatusForOrderStatus(nextStatus, order.paymentStatus),
          paymentMethod: nextStatus === "PAID" ? parsed.data.paymentMethod || "CASH" : order.paymentMethod,
          paidAt: nextStatus === "PAID" ? new Date() : order.paidAt,
          amountPaid: nextStatus === "PAID" ? order.total : order.amountPaid,
          balanceDue: nextStatus === "PAID" ? 0 : order.balanceDue,
          cancelledAt: nextStatus === "CANCELLED" ? new Date() : order.cancelledAt,
          cancellationReason: nextStatus === "CANCELLED" ? "Cancelled by restaurant manager" : order.cancellationReason
        }
      });
      const activeOrders = await tx.order.findMany({
        where: { tableId: order.tableId, status: { notIn: ["PAID", "CANCELLED"] } },
        orderBy: { createdAt: "desc" }
      });
      const tableStatus =
        nextStatus === "PAID" || nextStatus === "CANCELLED"
          ? nextTableStatusAfterClosing(activeOrders)
          : tableStatusByOrder[nextStatus] || "ACTIVE_ORDER";
      await tx.restaurantTable.update({
        where: { id: order.tableId },
        data: { status: tableStatus }
      });
      await tx.activityLog.create({
        data: {
          restaurantId: user.restaurantId,
          userId: user.id,
          action: nextStatus === "PAID" ? "ORDER_MARKED_PAID" : nextStatus === "CANCELLED" ? "ORDER_CANCELLED_BY_MANAGER" : "ORDER_STATUS_UPDATED",
          description: `${order.orderNumber} changed to ${nextStatus}`
        }
      });
      return result;
    });

    revalidatePath("/dashboard/orders");
    revalidatePath("/dashboard/tables");
    return NextResponse.json({ order: updated });
  } catch (error) {
    console.error("dashboard update order status failed", error);
    return NextResponse.json({ error: "Could not update order status." }, { status: 500 });
  }
}
