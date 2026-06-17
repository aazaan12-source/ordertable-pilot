import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { calculateTotals, toNumber } from "@/lib/pricing";
import { getCancelInfo, nextTableStatusAfterClosing, serializeOrder } from "@/lib/order-utils";
import { clientIpFromHeaders, userAgentFromHeaders } from "@/lib/security";
import { rateLimit } from "@/lib/rate-limit";
import { emitLiveOrdersChanged } from "@/lib/live-order-events";

const updateOrderSchema = z.object({
  specialNote: z.string().max(500).optional().nullable(),
  items: z.array(z.object({
    menuItemId: z.string().min(1).max(100),
    quantity: z.number().int().min(1).max(50),
    specialInstruction: z.string().max(300).optional().nullable()
  })).min(1).max(100)
});

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    if (id.length > 100) return NextResponse.json({ error: "Invalid order." }, { status: 400 });
    const ipAddress = clientIpFromHeaders(request.headers);
    if (!rateLimit(`customer-order-read:${ipAddress}`, 600, 5 * 60_000).allowed) {
      return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
    }
    const order = await db.order.findUnique({
      where: { id },
      include: { table: true, restaurant: true, items: true, waiterRequests: true }
    });
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    return NextResponse.json(
      { order: serializeOrder(order) },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("customer order status failed", error);
    return NextResponse.json({ error: "Could not load order status right now." }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    if (id.length > 100) return NextResponse.json({ error: "Invalid order." }, { status: 400 });
    const parsed = updateOrderSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid order details." }, { status: 400 });
    const totalQuantity = parsed.data.items.reduce((sum, item) => sum + item.quantity, 0);
    if (totalQuantity > 100) {
      return NextResponse.json({ error: "Too many items in one order. Please split the order or call staff." }, { status: 400 });
    }
    const ipAddress = clientIpFromHeaders(request.headers);
    const userAgent = userAgentFromHeaders(request.headers);
    if (!rateLimit(`customer-order-write:${ipAddress}`, 20, 5 * 60_000).allowed) {
      return NextResponse.json({ error: "Too many order attempts. Please wait or call staff." }, { status: 429 });
    }

    const order = await db.order.findUnique({
      where: { id },
      include: { restaurant: true }
    });
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if (order.status !== "PENDING") {
      return NextResponse.json({ error: "This order can only be edited before the restaurant accepts it." }, { status: 409 });
    }

    const menuIds = [...new Set(parsed.data.items.map((item) => item.menuItemId))];
    const menuItems = await db.menuItem.findMany({
      where: { id: { in: menuIds }, restaurantId: order.restaurantId, isActive: true, isAvailable: true }
    });
    if (menuItems.length !== menuIds.length) {
      return NextResponse.json({ error: "One or more items are unavailable. Please refresh the menu." }, { status: 409 });
    }

    const byId = new Map(menuItems.map((item) => [item.id, item]));
    const nextItems = parsed.data.items.map((item) => {
      const menuItem = byId.get(item.menuItemId)!;
      const unitPrice = toNumber(menuItem.price);
      const totalPrice = unitPrice * item.quantity;
      return {
        menuItemId: menuItem.id,
        itemName: menuItem.name,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
        specialInstruction: item.specialInstruction || null
      };
    });
    const totals = calculateTotals(nextItems.map((item) => item.totalPrice), order.restaurant.serviceChargePercent, order.restaurant.taxPercent);

    const updated = await db.$transaction(async (tx) => {
      await tx.orderItem.deleteMany({ where: { orderId: order.id } });
      await tx.activityLog.create({
        data: {
          restaurantId: order.restaurantId,
          action: "ORDER_EDITED_BY_CUSTOMER",
          description: `${order.orderNumber} edited before acceptance`,
          ipAddress,
          userAgent
        }
      });
      return tx.order.update({
        where: { id: order.id },
        data: {
          subtotal: totals.subtotal,
          serviceCharges: totals.serviceCharges,
          tax: totals.tax,
          discount: totals.discount,
          total: totals.total,
          specialNote: parsed.data.specialNote || null,
          items: { create: nextItems }
        }
      });
    });

    emitLiveOrdersChanged(order.restaurantId);

    return NextResponse.json({ orderId: updated.id, orderNumber: updated.orderNumber });
  } catch (error) {
    console.error("customer edit order failed", error);
    return NextResponse.json({ error: "Could not update this order right now." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    if (id.length > 100) return NextResponse.json({ error: "Invalid order." }, { status: 400 });
    const ipAddress = clientIpFromHeaders(request.headers);
    const userAgent = userAgentFromHeaders(request.headers);
    if (!rateLimit(`customer-order-write:${ipAddress}`, 20, 5 * 60_000).allowed) {
      return NextResponse.json({ error: "Too many order attempts. Please wait or call staff." }, { status: 429 });
    }
    const order = await db.order.findUnique({ where: { id }, include: { restaurant: true } });
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    const cancelInfo = getCancelInfo(order, order.restaurant.customerCancelWindowMinutes);
    if (!cancelInfo.canCancel) {
      const message =
        cancelInfo.reason === "expired"
          ? "Cancellation time has expired. Please call waiter."
          : cancelInfo.reason === "kitchen_started"
            ? "This order is already being prepared. Please call waiter."
            : "This order can no longer be cancelled.";
      return NextResponse.json({ error: message }, { status: 409 });
    }

    await db.$transaction(async (tx) => {
      await tx.order.update({
        where: { id },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancellationReason: "Customer cancelled within allowed time window"
        }
      });
      const activeOrders = await tx.order.findMany({
        where: { tableId: order.tableId, status: { notIn: ["PAID", "CANCELLED"] }, id: { not: order.id } },
        orderBy: { createdAt: "desc" }
      });
      await tx.restaurantTable.update({ where: { id: order.tableId }, data: { status: nextTableStatusAfterClosing(activeOrders) } });
      await tx.activityLog.create({
        data: {
          restaurantId: order.restaurantId,
          action: "ORDER_CANCELLED_BY_CUSTOMER",
          description: `${order.orderNumber} cancelled by customer`,
          ipAddress,
          userAgent
        }
      });
    });

    emitLiveOrdersChanged(order.restaurantId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("customer cancel order failed", error);
    return NextResponse.json({ error: "Could not cancel this order right now." }, { status: 500 });
  }
}
