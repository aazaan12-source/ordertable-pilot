import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/permissions";
import { getDashboardOrders } from "@/lib/dashboard-live-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "RESTAURANT_MANAGER" || !user.restaurantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const orders = await getDashboardOrders(user.restaurantId);
    return NextResponse.json(
      { orders },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("dashboard live orders failed", error);
    return NextResponse.json({ error: "Could not load live orders." }, { status: 500 });
  }
}
