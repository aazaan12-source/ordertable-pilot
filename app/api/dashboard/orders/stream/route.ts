import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/permissions";
import { getDashboardOrders, getDashboardOrdersChangeToken } from "@/lib/dashboard-live-data";
import { createLiveOrderDbListener } from "@/lib/live-order-db-listener";
import { onLiveOrdersChanged } from "@/lib/live-order-events";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const maxDuration = 60;

const encoder = new TextEncoder();
const changePollMs = 3000;

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
      let lastChangeToken = "";
      let pushing = false;
      let queued = false;
      let checking = false;
      const timers: ReturnType<typeof setInterval>[] = [];
      let closeTimer: ReturnType<typeof setTimeout> | undefined;
      let unsubscribe = () => {};
      let unsubscribeDb = async () => {};

      const close = () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        void unsubscribeDb();
        for (const timer of timers) clearInterval(timer);
        if (closeTimer) clearTimeout(closeTimer);
        try {
          controller.close();
        } catch {
          // Connection may already be closed.
        }
      };
      request.signal.addEventListener("abort", close);

      async function pushOrders(force = false) {
        if (closed) return;
        if (pushing) {
          queued = true;
          return;
        }
        pushing = true;
        try {
          const orders = await getDashboardOrders(restaurantId);
          const payload = JSON.stringify({ orders });
          if (force || payload !== lastPayload) {
            lastPayload = payload;
            lastChangeToken = await getDashboardOrdersChangeToken(restaurantId);
            controller.enqueue(streamEvent("orders", { orders }));
          }
        } catch (error) {
          if (!closed) controller.enqueue(streamEvent("error", { message: "Live order stream temporarily failed." }));
          console.error("LIVE_ORDER_STREAM_FAILED", error);
        } finally {
          pushing = false;
          if (queued && !closed) {
            queued = false;
            void pushOrders(true);
          }
        }
      }

      unsubscribe = onLiveOrdersChanged(restaurantId, () => {
        void pushOrders(true);
      });

      try {
        unsubscribeDb = await createLiveOrderDbListener(restaurantId, () => {
          void pushOrders(true);
        });
      } catch (error) {
        console.error("LIVE_ORDER_DB_LISTENER_START_FAILED", error);
      }

      async function pushIfChanged() {
        if (closed || checking) return;
        checking = true;
        try {
          const nextChangeToken = await getDashboardOrdersChangeToken(restaurantId);
          if (nextChangeToken !== lastChangeToken) {
            lastChangeToken = nextChangeToken;
            void pushOrders(true);
          }
        } catch (error) {
          if (!closed) controller.enqueue(streamEvent("error", { message: "Live order check temporarily failed." }));
          console.error("LIVE_ORDER_CHANGE_CHECK_FAILED", error);
        } finally {
          checking = false;
        }
      }

      await pushOrders(true);

      timers.push(setInterval(() => {
        void pushIfChanged();
      }, changePollMs));

      timers.push(setInterval(() => {
        if (!closed) controller.enqueue(streamEvent("ping", { at: Date.now() }));
      }, 15_000));

      closeTimer = setTimeout(() => {
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
