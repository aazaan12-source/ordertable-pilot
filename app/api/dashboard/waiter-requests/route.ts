import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/permissions";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "RESTAURANT_MANAGER" || !user.restaurantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const requests = await db.waiterRequest.findMany({
      where: { restaurantId: user.restaurantId, status: "PENDING" },
      include: { table: true, order: true },
      orderBy: { createdAt: "desc" }
    });
    return NextResponse.json({ requests });
  } catch (error) {
    console.error("dashboard waiter requests failed", error);
    return NextResponse.json({ error: "Could not load waiter requests." }, { status: 500 });
  }
}
