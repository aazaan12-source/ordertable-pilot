import { NextRequest, NextResponse } from "next/server";
import { OrderStatus, Prisma, RestaurantStatus, TableStatus } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { calculateTotals, toNumber } from "@/lib/pricing";
import { nextOrderNumber, nextTableStatusAfterClosing } from "@/lib/order-utils";
import { clientIpFromHeaders, publicOrderLimitStatus, recordPublicOrderAttempt, userAgentFromHeaders } from "@/lib/security";

const createOrderSchema = z.object({
  restaurantSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  tableNumber: z.number().int().min(1).max(500),
  customerSessionId: z.string().max(120).optional().nullable(),
  placedByType: z.enum(["CUSTOMER", "WAITER"]).default("CUSTOMER"),
  customerName: z.string().max(80).optional().nullable(),
  waiterName: z.string().max(80).optional().nullable(),
  activeOrderId: z.string().max(100).optional().nullable(),
  specialNote: z.string().max(500).optional().nullable(),
  items: z.array(z.object({
    menuItemId: z.string().min(1).max(100),
    quantity: z.number().int().min(1).max(50),
    specialInstruction: z.string().max(300).optional().nullable()
  })).min(1).max(100)
});

export async function POST(request: NextRequest) {
  try {
    const ipAddress = clientIpFromHeaders(request.headers);
    const userAgent = userAgentFromHeaders(request.headers);

    const parsed = createOrderSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid order details." }, { status: 400 });

    const { restaurantSlug, tableNumber, items, specialNote, customerSessionId, placedByType, activeOrderId } = parsed.data;
    const customerName = (parsed.data.customerName || "").trim() || null;
    const waiterName = placedByType === "WAITER" ? (parsed.data.waiterName || "").trim() : null;
    if (placedByType === "WAITER" && !waiterName) {
      return NextResponse.json({ error: "Please enter waiter name before sending the order." }, { status: 400 });
    }
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    if (totalQuantity > 100) {
      return NextResponse.json({ error: "Too many items in one order. Please split the order or call staff." }, { status: 400 });
    }

    const ipLimit = await publicOrderLimitStatus({ ipAddress, customerSessionId });
    if (!ipLimit.allowed) {
      await recordPublicOrderAttempt({ ipAddress, customerSessionId });
      return NextResponse.json({ error: "Too many order attempts. Please wait or call staff." }, { status: 429 });
    }

    const restaurant = await db.restaurant.findUnique({ where: { slug: restaurantSlug } });
    if (!restaurant || restaurant.status !== RestaurantStatus.ACTIVE) {
      return NextResponse.json({ error: "Restaurant is not accepting orders." }, { status: 400 });
    }
    if (!restaurant.orderingEnabled) {
      return NextResponse.json({ error: "Online ordering is temporarily paused. Please call the waiter." }, { status: 400 });
    }

    const table = await db.restaurantTable.findUnique({
      where: { restaurantId_tableNumber: { restaurantId: restaurant.id, tableNumber } }
    });
    if (!table) return NextResponse.json({ error: "Invalid table QR code." }, { status: 404 });
    if (table.status === TableStatus.INACTIVE) {
      return NextResponse.json({ error: "This table QR is currently inactive. Please call staff." }, { status: 403 });
    }

    const tableLimit = await publicOrderLimitStatus({ ipAddress, restaurantId: restaurant.id, tableNumber, customerSessionId });
    if (!tableLimit.allowed) {
      await recordPublicOrderAttempt({ ipAddress, restaurantId: restaurant.id, tableNumber, customerSessionId });
      return NextResponse.json({ error: "Too many order attempts. Please wait or call staff." }, { status: 429 });
    }

    const menuIds = [...new Set(items.map((item) => item.menuItemId))];
    const menuItems = await db.menuItem.findMany({
      where: { id: { in: menuIds }, restaurantId: restaurant.id, isActive: true, isAvailable: true }
    });
    if (menuItems.length !== menuIds.length) {
      return NextResponse.json({ error: "One or more items are unavailable. Please refresh the menu." }, { status: 409 });
    }

    const byId = new Map(menuItems.map((item) => [item.id, item]));
    const orderItems = items.map((item) => {
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
    const totals = calculateTotals(orderItems.map((item) => item.totalPrice), restaurant.serviceChargePercent, restaurant.taxPercent);
    const activeStatuses: OrderStatus[] = ["PENDING", "ACCEPTED", "PREPARING", "READY", "SERVED", "BILL_REQUESTED"];
    const activeOrder = activeOrderId
      ? await db.order.findFirst({
          where: { id: activeOrderId, restaurantId: restaurant.id, tableId: table.id, status: { in: activeStatuses }, paymentStatus: { not: "PAID" } },
          include: { items: true }
        })
      : null;
    const source = placedByType === "WAITER" ? "WAITER_ASSISTED_QR" : "ONLINE_QR_CUSTOMER";
    let order: { id: string; orderNumber: string } | null = null;

    if (activeOrder) {
      const nextSubtotal = toNumber(activeOrder.subtotal) + totals.subtotal;
      const nextTotals = calculateTotals([nextSubtotal], restaurant.serviceChargePercent, restaurant.taxPercent, activeOrder.discount);
      order = await db.order.update({
        where: { id: activeOrder.id },
        data: {
          subtotal: nextTotals.subtotal,
          serviceCharges: nextTotals.serviceCharges,
          tax: nextTotals.tax,
          discount: nextTotals.discount,
          total: nextTotals.total,
          specialNote: specialNote || activeOrder.specialNote,
          customerName: customerName || activeOrder.customerName,
          waiterName: waiterName || activeOrder.waiterName,
          source: activeOrder.source === "WAITER_ASSISTED_QR" || source === "WAITER_ASSISTED_QR" ? "WAITER_ASSISTED_QR" : activeOrder.source,
          items: { create: orderItems.map((item) => ({ ...item, addedAfterInitialOrder: true })) }
        }
      });

      Promise.allSettled([
        db.publicOrderAttempt.create({ data: { ipAddress, restaurantId: restaurant.id, tableNumber, customerSessionId: customerSessionId || null } }),
        db.restaurantTable.update({ where: { id: table.id }, data: { status: nextTableStatusAfterClosing([{ status: activeOrder.status, createdAt: activeOrder.createdAt }]) } }),
        db.activityLog.create({
          data: {
            restaurantId: restaurant.id,
            orderId: order.id,
            action: source === "WAITER_ASSISTED_QR" ? "WAITER_ASSISTED_ITEMS_ADDED" : "ONLINE_ORDER_ITEMS_ADDED",
            description: `${order.orderNumber} received added QR items from table ${table.tableNumber}${waiterName ? ` by waiter ${waiterName}` : ""}`,
            ipAddress,
            userAgent
          }
        })
      ]).then((results) => {
        for (const result of results) if (result.status === "rejected") console.error("customer order side effect failed", result.reason);
      });
    } else {
      let orderNumber = await nextOrderNumber(restaurant.id);
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          order = await db.order.create({
            data: {
              restaurantId: restaurant.id,
              tableId: table.id,
              orderNumber,
              source,
              status: "PENDING",
              subtotal: totals.subtotal,
              serviceCharges: totals.serviceCharges,
              tax: totals.tax,
              discount: totals.discount,
              total: totals.total,
              customerSessionId: customerSessionId || null,
              customerName,
              waiterName,
              specialNote: specialNote || null,
              items: { create: orderItems }
            }
          });
          break;
        } catch (error) {
          const isOrderNumberCollision = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
          if (!isOrderNumberCollision || attempt === 2) throw error;
          orderNumber = await nextOrderNumber(restaurant.id);
        }
      }

      if (!order) throw new Error("Order could not be created.");

      Promise.allSettled([
        db.publicOrderAttempt.create({ data: { ipAddress, restaurantId: restaurant.id, tableNumber, customerSessionId: customerSessionId || null } }),
        db.restaurantTable.update({ where: { id: table.id }, data: { status: TableStatus.ACTIVE_ORDER } }),
        db.activityLog.create({
          data: {
            restaurantId: restaurant.id,
            orderId: order.id,
            action: source === "WAITER_ASSISTED_QR" ? "WAITER_ASSISTED_ORDER_CREATED" : "ONLINE_ORDER_CREATED",
            description: `${order.orderNumber} created from table ${table.tableNumber}${waiterName ? ` by waiter ${waiterName}` : ""}`,
            ipAddress,
            userAgent
          }
        })
      ]).then((results) => {
        for (const result of results) if (result.status === "rejected") console.error("customer order side effect failed", result.reason);
      });
    }

    if (!order) throw new Error("Order could not be created.");

    return NextResponse.json({ orderId: order.id, orderNumber: order.orderNumber });
  } catch (error) {
    console.error("customer create order failed", error);
    return NextResponse.json({ error: "Could not place order right now. Please ask restaurant staff for help." }, { status: 500 });
  }
}
