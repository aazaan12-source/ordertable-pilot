import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { clientIpFromHeaders } from "@/lib/security";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  orderId: z.string(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional().nullable()
});

export async function POST(request: Request) {
  try {
    const ipAddress = clientIpFromHeaders(request.headers);
    if (!rateLimit(`feedback:${ipAddress}`, 10, 5 * 60_000).allowed) {
      return NextResponse.json({ error: "Too many feedback attempts. Please wait." }, { status: 429 });
    }
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid feedback." }, { status: 400 });
    const order = await db.order.findUnique({ where: { id: parsed.data.orderId } });
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    const feedback = await db.feedback.create({
      data: {
        restaurantId: order.restaurantId,
        tableId: order.tableId,
        orderId: order.id,
        rating: parsed.data.rating,
        comment: parsed.data.comment || null
      }
    });
    return NextResponse.json({ id: feedback.id });
  } catch (error) {
    console.error("customer feedback failed", error);
    return NextResponse.json({ error: "Could not save feedback right now." }, { status: 500 });
  }
}
