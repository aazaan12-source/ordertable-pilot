import { NextResponse } from "next/server";
import { RestaurantStatus, TableStatus } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { clientIpFromHeaders, userAgentFromHeaders } from "@/lib/security";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  restaurantSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80).optional(),
  tableNumber: z.number().int().min(1).max(500).optional(),
  orderId: z.string().max(100).optional(),
  type: z.enum(["CALL_WAITER", "BILL_REQUEST", "WATER_REQUEST", "CLEAN_TABLE"])
});

export async function POST(request: Request) {
  try {
    const ipAddress = clientIpFromHeaders(request.headers);
    const userAgent = userAgentFromHeaders(request.headers);
    if (!rateLimit(`waiter:${ipAddress}`, 20, 5 * 60_000).allowed) {
      return NextResponse.json({ error: "Too many requests. Please wait or call staff." }, { status: 429 });
    }
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

    let restaurantId: string | undefined;
    let tableId: string | undefined;
    let orderId: string | null = parsed.data.orderId || null;
    let orderNumber: string | undefined;

    if (orderId) {
      const order = await db.order.findUnique({ where: { id: orderId }, include: { table: true, restaurant: true } });
      if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
      if (order.restaurant.status !== RestaurantStatus.ACTIVE || !order.restaurant.orderingEnabled || order.table.status === TableStatus.INACTIVE) {
        return NextResponse.json({ error: "This table cannot send requests right now." }, { status: 403 });
      }
      restaurantId = order.restaurantId;
      tableId = order.tableId;
      orderNumber = order.orderNumber;
    } else if (parsed.data.restaurantSlug && parsed.data.tableNumber) {
      const table = await db.restaurantTable.findFirst({
        where: { tableNumber: parsed.data.tableNumber, restaurant: { slug: parsed.data.restaurantSlug } },
        include: { restaurant: true }
      });
      if (!table) return NextResponse.json({ error: "Invalid table QR code." }, { status: 404 });
      if (table.restaurant.status !== RestaurantStatus.ACTIVE || !table.restaurant.orderingEnabled || table.status === TableStatus.INACTIVE) {
        return NextResponse.json({ error: "This table cannot send requests right now." }, { status: 403 });
      }
      restaurantId = table.restaurantId;
      tableId = table.id;

      if (parsed.data.type === "BILL_REQUEST") {
        const activeOrder = await db.order.findFirst({
          where: {
            restaurantId,
            tableId,
            status: { in: ["SERVED", "BILL_REQUESTED"] },
            paymentStatus: "UNPAID"
          },
          orderBy: { createdAt: "desc" }
        });
        if (!activeOrder) {
          return NextResponse.json({ error: "No active order found for billing. Please call waiter." }, { status: 404 });
        }
        orderId = activeOrder.id;
        orderNumber = activeOrder.orderNumber;
      }
    }

    if (!restaurantId || !tableId) return NextResponse.json({ error: "Missing table information." }, { status: 400 });

    const recentDuplicate = await db.waiterRequest.findFirst({
      where: {
        restaurantId,
        tableId,
        orderId,
        type: parsed.data.type,
        status: "PENDING",
        createdAt: { gte: new Date(Date.now() - 8000) }
      },
      orderBy: { createdAt: "desc" }
    });

    if (recentDuplicate) {
      return NextResponse.json({ id: recentDuplicate.id, duplicate: true });
    }

    const waiterRequest = await db.$transaction(async (tx) => {
      const created = await tx.waiterRequest.create({
        data: { restaurantId, tableId, orderId, type: parsed.data.type }
      });

      if (parsed.data.type === "BILL_REQUEST" && orderId) {
        await tx.order.update({ where: { id: orderId }, data: { status: "BILL_REQUESTED" } });
        await tx.restaurantTable.update({ where: { id: tableId }, data: { status: "BILL_REQUESTED" } });
      }

      await tx.activityLog.create({
        data: {
          restaurantId,
          action: parsed.data.type === "BILL_REQUEST" ? "BILL_REQUESTED" : "WAITER_CALLED",
          description:
            parsed.data.type === "BILL_REQUEST"
              ? `Bill requested${orderNumber ? ` for ${orderNumber}` : ""}`
              : "Waiter called from customer table",
          ipAddress,
          userAgent
        }
      });

      return created;
    });

    return NextResponse.json({ id: waiterRequest.id });
  } catch (error) {
    console.error("customer waiter request failed", error);
    return NextResponse.json({ error: "Could not send request right now. Please call staff." }, { status: 500 });
  }
}
