import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeOrder } from "@/lib/order-utils";
import { clientIpFromHeaders } from "@/lib/security";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const maxDuration = 60;

const encoder = new TextEncoder();
const changePollMs = 700;

function streamEvent(event: string, data: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function getOrderChangeToken(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, updatedAt: true }
  });
  return order ? `${order.id}:${order.updatedAt.getTime()}` : "";
}

async function getOrderSnapshot(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { table: true, restaurant: true, items: true, waiterRequests: true }
  });
  return order ? serializeOrder(order) : null;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id.length > 100) return NextResponse.json({ error: "Invalid order." }, { status: 400 });

  const ipAddress = clientIpFromHeaders(request.headers);
  if (!rateLimit(`customer-order-stream:${ipAddress}`, 120, 5 * 60_000).allowed) {
    return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let lastChangeToken = "";
      let pushing = false;
      const timers: ReturnType<typeof setInterval>[] = [];
      let closeTimer: ReturnType<typeof setTimeout> | undefined;

      const close = () => {
        if (closed) return;
        closed = true;
        for (const timer of timers) clearInterval(timer);
        if (closeTimer) clearTimeout(closeTimer);
        try {
          controller.close();
        } catch {
          // Connection may already be closed.
        }
      };
      request.signal.addEventListener("abort", close);

      async function pushOrder(force = false) {
        if (closed || pushing) return;
        pushing = true;
        try {
          const nextChangeToken = await getOrderChangeToken(id);
          if (!nextChangeToken) {
            controller.enqueue(streamEvent("missing", { message: "Order not found." }));
            close();
            return;
          }
          if (!force && nextChangeToken === lastChangeToken) return;
          lastChangeToken = nextChangeToken;
          const order = await getOrderSnapshot(id);
          if (!order) {
            controller.enqueue(streamEvent("missing", { message: "Order not found." }));
            close();
            return;
          }
          controller.enqueue(streamEvent("order", { order }));
        } catch (error) {
          if (!closed) controller.enqueue(streamEvent("error", { message: "Order status stream temporarily failed." }));
          console.error("CUSTOMER_ORDER_STREAM_FAILED", error);
        } finally {
          pushing = false;
        }
      }

      await pushOrder(true);

      timers.push(setInterval(() => {
        void pushOrder();
      }, changePollMs));

      timers.push(setInterval(() => {
        if (!closed) controller.enqueue(streamEvent("ping", { at: Date.now() }));
      }, 15_000));

      closeTimer = setTimeout(close, 55_000);
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
