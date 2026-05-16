import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/permissions";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "RESTAURANT_MANAGER" || !user.restaurantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const orders = await db.order.findMany({
      where: { restaurantId: user.restaurantId },
      include: { table: true, items: true, waiterRequests: true },
      orderBy: { createdAt: "desc" },
      take: 100
    });
    return NextResponse.json(
      { orders },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("dashboard live orders failed", error);
    return NextResponse.json({ error: "Could not load live orders." }, { status: 500 });
  }
}
