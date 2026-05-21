import { NextRequest, NextResponse } from "next/server";
import { DemoOrder, DemoOrderStatus, DemoRequest } from "@/components/public/demo-simulation-store";
import { cleanDemoSession, getDemoState, setDemoState } from "@/lib/demo-simulation-state";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = cleanDemoSession(request.nextUrl.searchParams.get("session"));
  return NextResponse.json(getDemoState(session), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const session = cleanDemoSession(body.session);
    const state = getDemoState(session);

    if (body.type === "order") {
      const order = sanitizeOrder(body.order);
      if (!order) return NextResponse.json({ error: "Invalid demo order." }, { status: 400 });
      const nextState = setDemoState(session, { ...state, orders: [order, ...state.orders] });
      return NextResponse.json(nextState, { headers: { "Cache-Control": "no-store" } });
    }

    if (body.type === "request") {
      const demoRequest = sanitizeRequest(body.request);
      if (!demoRequest) return NextResponse.json({ error: "Invalid demo request." }, { status: 400 });
      const nextState = setDemoState(session, { ...state, requests: [demoRequest, ...state.requests] });
      return NextResponse.json(nextState, { headers: { "Cache-Control": "no-store" } });
    }

    if (body.type === "status") {
      const orderId = String(body.orderId || "");
      const status = safeStatus(body.status);
      if (!orderId || !status) return NextResponse.json({ error: "Invalid demo status." }, { status: 400 });
      const nextState = setDemoState(session, {
        ...state,
        orders: state.orders.map((order) => order.id === orderId ? { ...order, status, paymentStatus: status === "PAID" ? "PAID" : order.paymentStatus } : order)
      });
      return NextResponse.json(nextState, { headers: { "Cache-Control": "no-store" } });
    }

    if (body.type === "resolve-request") {
      const requestId = String(body.requestId || "");
      const nextState = setDemoState(session, {
        ...state,
        requests: state.requests.map((request) => request.id === requestId ? { ...request, status: "RESOLVED" } : request)
      });
      return NextResponse.json(nextState, { headers: { "Cache-Control": "no-store" } });
    }

    if (body.type === "reset") {
      const nextState = setDemoState(session, { orders: [], requests: [] });
      return NextResponse.json(nextState, { headers: { "Cache-Control": "no-store" } });
    }

    return NextResponse.json({ error: "Invalid demo action." }, { status: 400 });
  } catch (error) {
    console.error("DEMO_SIMULATION_STATE_FAILED", error);
    return NextResponse.json({ error: "Unable to update demo simulation." }, { status: 500 });
  }
}

function sanitizeOrder(value: unknown): DemoOrder | null {
  const order = value as Partial<DemoOrder>;
  if (!order || !order.id || !order.orderNumber || !order.items?.length) return null;
  const tableNumber = Number(order.tableNumber);
  if (!Number.isInteger(tableNumber) || tableNumber < 1 || tableNumber > 5) return null;
  return {
    id: String(order.id).slice(0, 80),
    orderNumber: String(order.orderNumber).slice(0, 40),
    tableNumber,
    source: order.source === "Waiter Assisted" ? "Waiter Assisted" : "Customer QR",
    customerName: order.customerName ? String(order.customerName).slice(0, 80) : undefined,
    waiterName: order.waiterName ? String(order.waiterName).slice(0, 80) : undefined,
    status: safeStatus(order.status) || "PENDING",
    paymentStatus: order.paymentStatus === "PAID" ? "PAID" : "UNPAID",
    total: Math.max(0, Number(order.total) || 0),
    createdAt: order.createdAt ? String(order.createdAt) : new Date().toISOString(),
    items: order.items.slice(0, 20).map((item) => ({
      id: String(item.id).slice(0, 80),
      name: String(item.name).slice(0, 100),
      category: String(item.category).slice(0, 60),
      price: Math.max(0, Number(item.price) || 0),
      quantity: Math.max(1, Math.min(20, Number(item.quantity) || 1)),
      note: item.note ? String(item.note).slice(0, 120) : undefined
    }))
  };
}

function sanitizeRequest(value: unknown): DemoRequest | null {
  const request = value as Partial<DemoRequest>;
  const tableNumber = Number(request?.tableNumber);
  if (!request?.id || !Number.isInteger(tableNumber) || tableNumber < 1 || tableNumber > 5) return null;
  return {
    id: String(request.id).slice(0, 80),
    tableNumber,
    type: request.type === "BILL_REQUEST" ? "BILL_REQUEST" : "CALL_WAITER",
    status: "PENDING",
    createdAt: request.createdAt ? String(request.createdAt) : new Date().toISOString()
  };
}

function safeStatus(value: unknown): DemoOrderStatus | null {
  const status = String(value || "");
  return ["PENDING", "ACCEPTED", "PREPARING", "READY", "SERVED", "BILL_REQUESTED", "PAID", "CANCELLED"].includes(status) ? status as DemoOrderStatus : null;
}
