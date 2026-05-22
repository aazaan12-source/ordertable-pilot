import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/permissions";
import { getDashboardSummary } from "@/lib/dashboard-live-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "RESTAURANT_MANAGER" || !user.restaurantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await getDashboardSummary(user.restaurantId), {
    headers: { "Cache-Control": "no-store, max-age=0" }
  });
}

