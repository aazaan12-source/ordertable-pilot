import { NextRequest, NextResponse } from "next/server";
import { RestaurantStatus, TableStatus } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { calculateTotals, toNumber } from "@/lib/pricing";
import { nextOrderNumber } from "@/lib/order-utils";
import { clientIpFromHeaders, publicOrderLimitStatus, recordPublicOrderAttempt, userAgentFromHeaders } from "@/lib/security";

const createOrderSchema = z.object({
  restaurantSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  tableNumber: z.number().int().min(1).max(500),
  customerSessionId: z.string().max(120).optional().nullable(),
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

    const { restaurantSlug, tableNumber, items, specialNote, customerSessionId } = parsed.data;
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
    const orderNumber = await nextOrderNumber(restaurant.id);

    const order = await db.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          restaurantId: restaurant.id,
          tableId: table.id,
          orderNumber,
          source: "ONLINE_QR",
          status: "PENDING",
          subtotal: totals.subtotal,
          serviceCharges: totals.serviceCharges,
          tax: totals.tax,
          discount: totals.discount,
          total: totals.total,
          customerSessionId: customerSessionId || null,
          specialNote: specialNote || null,
          items: { create: orderItems }
        }
      });
      await tx.publicOrderAttempt.create({
        data: { ipAddress, restaurantId: restaurant.id, tableNumber, customerSessionId: customerSessionId || null }
      });
      await tx.restaurantTable.update({ where: { id: table.id }, data: { status: TableStatus.ACTIVE_ORDER } });
      await tx.activityLog.create({
        data: {
          restaurantId: restaurant.id,
          action: "ORDER_CREATED",
          description: `${created.orderNumber} created from table ${table.tableNumber}`,
          ipAddress,
          userAgent
        }
      });
      return created;
    });

    return NextResponse.json({ orderId: order.id, orderNumber: order.orderNumber });
  } catch (error) {
    console.error("customer create order failed", error);
    return NextResponse.json({ error: "Could not place order right now. Please ask restaurant staff for help." }, { status: 500 });
  }
}
