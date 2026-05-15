import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/permissions";

export async function PATCH(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "RESTAURANT_MANAGER" || !user.restaurantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const request = await db.waiterRequest.findFirst({ where: { id, restaurantId: user.restaurantId } });
    if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });
    await db.waiterRequest.update({ where: { id }, data: { status: "RESOLVED", resolvedAt: new Date() } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("dashboard resolve waiter request failed", error);
    return NextResponse.json({ error: "Could not resolve request." }, { status: 500 });
  }
}
