import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/permissions";
import { getDashboardSummary } from "@/lib/dashboard-live-data";

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

      async function pushSummary(force = false) {
        if (closed) return;
        try {
          const summary = await getDashboardSummary(restaurantId);
          const payload = JSON.stringify(summary);
          if (force || payload !== lastPayload) {
            lastPayload = payload;
            controller.enqueue(streamEvent("summary", summary));
          } else {
            controller.enqueue(streamEvent("ping", { at: Date.now() }));
          }
        } catch (error) {
          controller.enqueue(streamEvent("error", { message: "Dashboard summary stream temporarily failed." }));
          console.error("DASHBOARD_SUMMARY_STREAM_FAILED", error);
        }
      }

      await pushSummary(true);
      const timer = setInterval(() => {
        void pushSummary();
      }, 700);

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
