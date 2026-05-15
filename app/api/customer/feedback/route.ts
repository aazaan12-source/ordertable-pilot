import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const schema = z.object({
  orderId: z.string(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional().nullable()
});

export async function POST(request: Request) {
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
}
