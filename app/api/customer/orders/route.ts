import { NextRequest, NextResponse } from "next/server";
import { Prisma, RestaurantStatus, TableStatus } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { calculateTotals, toNumber } from "@/lib/pricing";
import { clientIpFromHeaders } from "@/lib/security";
import { rateLimit } from "@/lib/rate-limit";

const createOrderSchema = z.object({
  restaurantSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  tableNumber: z.number().int().min(1).max(500),
  customerSessionId: z.string().max(120).optional().nullable(),
  placedByType: z.enum(["CUSTOMER", "WAITER"]).default("CUSTOMER"),
  customerName: z.string().max(80).optional().nullable(),
  waiterName: z.string().max(80).optional().nullable(),
  specialNote: z.string().max(500).optional().nullable(),
  items: z.array(z.object({
    menuItemId: z.string().min(1).max(100),
    quantity: z.number().int().min(1).max(50),
    specialInstruction: z.string().max(300).optional().nullable()
  })).min(1).max(100)
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function publicOrderNumber() {
  const timePart = Date.now().toString(36).toUpperCase();
  const randomPart = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `ORD-${timePart}-${randomPart}`;
}

export async function POST(request: NextRequest) {
  let debugInfo: { restaurantSlug?: string; tableNumber?: number; placedByType?: string; itemCount?: number } = {};
  try {
    const ipAddress = clientIpFromHeaders(request.headers);

    const parsed = createOrderSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid order details." }, { status: 400 });

    const { restaurantSlug, tableNumber, items, specialNote, customerSessionId, placedByType } = parsed.data;
    debugInfo = { restaurantSlug, tableNumber, placedByType, itemCount: items.length };
    const customerName = (parsed.data.customerName || "").trim() || null;
    const waiterName = placedByType === "WAITER" ? (parsed.data.waiterName || "").trim() : null;
    if (placedByType === "WAITER" && !waiterName) {
      return NextResponse.json({ error: "Please enter waiter name before sending the order." }, { status: 400 });
    }
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    if (totalQuantity > 100) {
      return NextResponse.json({ error: "Too many items in one order. Please split the order or call staff." }, { status: 400 });
    }

    const ipLimit = rateLimit(`public-order-ip:${ipAddress}`, 20, 5 * 60_000);
    const tableMemoryLimit = rateLimit(`public-order-table:${restaurantSlug}:${tableNumber}:${ipAddress}`, 5, 5 * 60_000);
    if (!ipLimit.allowed || !tableMemoryLimit.allowed) {
      return NextResponse.json({ error: "Too many order attempts. Please wait or call staff." }, { status: 429 });
    }

    const restaurant = await db.restaurant.findUnique({
      where: { slug: restaurantSlug },
      include: { tables: { where: { tableNumber }, take: 1 } }
    });
    if (!restaurant || restaurant.status !== RestaurantStatus.ACTIVE) {
      return NextResponse.json({ error: "Restaurant is not accepting orders." }, { status: 400 });
    }
    if (!restaurant.orderingEnabled) {
      return NextResponse.json({ error: "Online ordering is temporarily paused. Please call the waiter." }, { status: 400 });
    }

    const table = restaurant.tables[0];
    if (!table) return NextResponse.json({ error: "Invalid table QR code." }, { status: 404 });
    if (table.status === TableStatus.INACTIVE) {
      return NextResponse.json({ error: "This table QR is currently inactive. Please call staff." }, { status: 403 });
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
    const source = placedByType === "WAITER" ? "WAITER_ASSISTED_QR" : "ONLINE_QR_CUSTOMER";
    let order: { id: string; orderNumber: string } | null = null;

    let orderNumber = publicOrderNumber();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        order = await db.order.create({
          data: {
            restaurantId: restaurant.id,
            tableId: table.id,
            orderNumber,
            source,
            status: "PENDING",
            paymentStatus: "UNPAID",
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
        orderNumber = publicOrderNumber();
      }
    }

    if (!order) throw new Error("Order could not be created.");

    return NextResponse.json({ orderId: order.id, orderNumber: order.orderNumber });
  } catch (error) {
    console.error("QR_ORDER_CREATE_FAILED", { ...debugInfo, error });
    if (request.headers.get("x-ordertable-debug") === "1") {
      const code = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : "UNKNOWN";
      const message = error instanceof Error ? error.message : "Unknown error";
      return NextResponse.json(
        { error: "Could not place order right now. Please ask restaurant staff for help.", debug: { code, message, version: "order-route-node-20260519" } },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: "Could not place order right now. Please ask restaurant staff for help." }, { status: 500 });
  }
}
