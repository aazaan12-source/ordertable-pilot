import { DemoOrder, DemoOrderStatus } from "@/components/public/demo-simulation-store";
import { db } from "@/lib/db";

export const demoIncompleteSimulationMs = 15 * 60 * 1000;

export const demoStageLabels: Record<DemoOrderStatus, string> = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  PREPARING: "Preparing",
  READY: "Ready",
  SERVED: "Served",
  BILL_REQUESTED: "Bill Requested",
  PAID: "Paid",
  CANCELLED: "Cancelled"
};

function expiresAt(now: Date) {
  return new Date(now.getTime() + demoIncompleteSimulationMs);
}

function orderStartedAt(order: DemoOrder) {
  const startedAt = new Date(order.createdAt);
  return Number.isNaN(startedAt.getTime()) ? new Date() : startedAt;
}

function itemCount(order: DemoOrder) {
  return order.items.reduce((sum, item) => sum + item.quantity, 0);
}

export async function recordDemoSimulationOrder(session: string, order: DemoOrder) {
  const now = new Date();
  await db.demoSimulationRun.upsert({
    where: { demoOrderId: order.id },
    create: {
      session,
      demoOrderId: order.id,
      orderNumber: order.orderNumber,
      tableNumber: order.tableNumber,
      source: order.source,
      total: order.total,
      itemCount: itemCount(order),
      lastStage: order.status,
      status: "IN_PROGRESS",
      startedAt: orderStartedAt(order),
      lastActivityAt: now,
      expiresAt: expiresAt(now)
    },
    update: {
      orderNumber: order.orderNumber,
      tableNumber: order.tableNumber,
      source: order.source,
      total: order.total,
      itemCount: itemCount(order),
      lastStage: order.status,
      lastActivityAt: now,
      expiresAt: expiresAt(now)
    }
  });
}

export async function recordDemoSimulationStatus(session: string, order: DemoOrder, status: DemoOrderStatus) {
  const now = new Date();
  const runStatus = status === "PAID" ? "COMPLETED" : status === "CANCELLED" ? "PARTIAL" : "IN_PROGRESS";
  await db.demoSimulationRun.upsert({
    where: { demoOrderId: order.id },
    create: {
      session,
      demoOrderId: order.id,
      orderNumber: order.orderNumber,
      tableNumber: order.tableNumber,
      source: order.source,
      total: order.total,
      itemCount: itemCount(order),
      lastStage: status,
      status: runStatus,
      startedAt: orderStartedAt(order),
      lastActivityAt: now,
      completedAt: status === "PAID" ? now : null,
      partialAt: status === "CANCELLED" ? now : null,
      expiresAt: runStatus === "IN_PROGRESS" ? expiresAt(now) : null
    },
    update: {
      orderNumber: order.orderNumber,
      tableNumber: order.tableNumber,
      source: order.source,
      total: order.total,
      itemCount: itemCount(order),
      lastStage: status,
      status: runStatus,
      lastActivityAt: now,
      completedAt: status === "PAID" ? now : undefined,
      partialAt: status === "CANCELLED" ? now : undefined,
      expiresAt: runStatus === "IN_PROGRESS" ? expiresAt(now) : null
    }
  });
}

export async function recordDemoSimulationPartial(session: string, order: DemoOrder, stage: DemoOrderStatus = order.status) {
  const now = new Date();
  await db.demoSimulationRun.upsert({
    where: { demoOrderId: order.id },
    create: {
      session,
      demoOrderId: order.id,
      orderNumber: order.orderNumber,
      tableNumber: order.tableNumber,
      source: order.source,
      total: order.total,
      itemCount: itemCount(order),
      lastStage: stage,
      status: "PARTIAL",
      startedAt: orderStartedAt(order),
      lastActivityAt: now,
      partialAt: now,
      expiresAt: null
    },
    update: {
      lastStage: stage,
      status: "PARTIAL",
      lastActivityAt: now,
      partialAt: now,
      expiresAt: null
    }
  });
}

export async function expireStaleDemoSimulationRuns(now = new Date()) {
  await db.demoSimulationRun.updateMany({
    where: { status: "IN_PROGRESS", expiresAt: { lt: now } },
    data: { status: "PARTIAL", partialAt: now, expiresAt: null }
  });
}
