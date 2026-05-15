import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/permissions";

const schema = z.object({ type: z.enum(["KITCHEN", "BILL"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "RESTAURANT_MANAGER" || !user.restaurantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid print type." }, { status: 400 });

    const order = await db.order.findFirst({ where: { id, restaurantId: user.restaurantId } });
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

    const now = new Date();
    await db.$transaction(async (tx) => {
      await tx.order.update({
        where: { id },
        data: parsed.data.type === "KITCHEN" ? { printedKitchenAt: now } : { printedBillAt: now }
      });
      await tx.activityLog.create({
        data: {
          restaurantId: user.restaurantId,
          userId: user.id,
          action: parsed.data.type === "KITCHEN" ? "KITCHEN_SLIP_PRINTED" : "CUSTOMER_BILL_PRINTED",
          description: `${order.orderNumber} ${parsed.data.type === "KITCHEN" ? "kitchen slip" : "customer bill"} printed`
        }
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("dashboard record print failed", error);
    return NextResponse.json({ error: "Could not record print event." }, { status: 500 });
  }
}
