import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/permissions";
import { getDashboardOrders } from "@/lib/dashboard-live-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const maxDuration = 60;

const encoder = new TextEncoder();

function streamEvent(event: string, data: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "RESTAURANT_MANAGER" || !user.restaurantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const restaurantId = user.restaurantId;
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let lastPayload = "";
      const close = () => {
        closed = true;
        try {
          controller.close();
        } catch {
          // Connection may already be closed.
        }
      };
      request.signal.addEventListener("abort", close);

      async function pushOrders(force = false) {
        if (closed) return;
        try {
          const orders = await getDashboardOrders(restaurantId);
          const payload = JSON.stringify({ orders });
          if (force || payload !== lastPayload) {
            lastPayload = payload;
            controller.enqueue(streamEvent("orders", { orders }));
          } else {
            controller.enqueue(streamEvent("ping", { at: Date.now() }));
          }
        } catch (error) {
          controller.enqueue(streamEvent("error", { message: "Live order stream temporarily failed." }));
          console.error("LIVE_ORDER_STREAM_FAILED", error);
        }
      }

      await pushOrders(true);
      const timer = setInterval(() => {
        void pushOrders();
      }, 500);

      setTimeout(() => {
        clearInterval(timer);
        close();
      }, 55_000);
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}

