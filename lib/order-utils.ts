import { OrderSource, OrderStatus, PaymentStatus, TableStatus, type Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export async function nextOrderNumber(restaurantId: string) {
  const latest = await db.order.findFirst({
    where: { restaurantId, orderNumber: { startsWith: "ORD-" } },
    select: { orderNumber: true },
    orderBy: { orderNumber: "desc" }
  });
  const match = latest ? /^ORD-(\d+)$/.exec(latest.orderNumber) : null;
  const highest = match ? Number(match[1]) : 0;
  return `ORD-${String(highest + 1).padStart(4, "0")}`;
}

export const orderStatuses: OrderStatus[] = [
  "PENDING",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "SERVED",
  "BILL_REQUESTED",
  "PAID",
  "CANCELLED"
];

export const orderStatusLabels: Record<OrderStatus, string> = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  PREPARING: "Preparing",
  READY: "Ready",
  SERVED: "Served",
  BILL_REQUESTED: "Bill Requested",
  PAID: "Paid",
  CANCELLED: "Cancelled"
};

export const orderSourceLabels: Record<OrderSource, string> = {
  ONLINE_QR: "Customer QR",
  ONLINE_QR_CUSTOMER: "Customer QR",
  WAITER_ASSISTED_QR: "Waiter Assisted",
  MANUAL_DASHBOARD: "Manual",
  WAITER_ENTRY: "Waiter Entry"
};

export function orderSourceLabel(source: string) {
  return orderSourceLabels[source as OrderSource] || "Customer QR";
}

export const tableStatusByOrder: Partial<Record<OrderStatus, TableStatus>> = {
  PENDING: "ACTIVE_ORDER",
  ACCEPTED: "ACTIVE_ORDER",
  PREPARING: "PREPARING",
  READY: "PREPARING",
  SERVED: "SERVED",
  BILL_REQUESTED: "BILL_REQUESTED",
  PAID: "EMPTY",
  CANCELLED: "EMPTY"
};

export function getCancelInfo(order: { status: OrderStatus; createdAt: Date | string }, windowMinutes: number) {
  const windowMs = Math.max(0, windowMinutes) * 60_000;
  const createdMs = new Date(order.createdAt).getTime();
  const expiresAt = new Date(createdMs + windowMs);
  const remainingMs = Math.max(0, expiresAt.getTime() - Date.now());
  const statusAllowsCancel = order.status === "PENDING" || order.status === "ACCEPTED";
  return {
    canCancel: statusAllowsCancel && remainingMs > 0,
    expiresAt,
    remainingSeconds: Math.ceil(remainingMs / 1000),
    reason: !statusAllowsCancel
      ? order.status === "PREPARING" || order.status === "READY" || order.status === "SERVED"
        ? "kitchen_started"
        : "closed"
      : remainingMs <= 0
        ? "expired"
        : null
  };
}

export function nextTableStatusAfterClosing(activeOrders: { status: OrderStatus; createdAt: Date }[]) {
  const open = activeOrders.filter((order) => order.status !== "PAID" && order.status !== "CANCELLED");
  if (open.length === 0) return TableStatus.EMPTY;
  return tableStatusByOrder[open[0].status] || TableStatus.ACTIVE_ORDER;
}

export function serializeOrder(order: Prisma.OrderGetPayload<{
  include: {
    table: true;
    restaurant: true;
    items: true;
    waiterRequests: true;
  };
}>) {
  const cancelInfo = getCancelInfo(order, order.restaurant.customerCancelWindowMinutes);
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    statusLabel: orderStatusLabels[order.status],
    source: order.source,
    sourceLabel: orderSourceLabel(order.source),
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    specialNote: order.specialNote,
    subtotal: order.subtotal.toString(),
    serviceCharges: order.serviceCharges.toString(),
    tax: order.tax.toString(),
    discount: order.discount.toString(),
    total: order.total.toString(),
    createdAt: order.createdAt.toISOString(),
    cancelledAt: order.cancelledAt?.toISOString() || null,
    cancellationReason: order.cancellationReason,
    printedKitchenAt: order.printedKitchenAt?.toISOString() || null,
    printedBillAt: order.printedBillAt?.toISOString() || null,
    paidAt: order.paidAt?.toISOString() || null,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    waiterName: order.waiterName,
    amountPaid: order.amountPaid?.toString() || null,
    balanceDue: order.balanceDue?.toString() || null,
    cancelInfo: {
      canCancel: cancelInfo.canCancel,
      expiresAt: cancelInfo.expiresAt.toISOString(),
      remainingSeconds: cancelInfo.remainingSeconds,
      reason: cancelInfo.reason
    },
    restaurant: {
      id: order.restaurant.id,
      name: order.restaurant.name,
      branchName: order.restaurant.branchName,
      city: order.restaurant.city,
      address: order.restaurant.address,
      phone: order.restaurant.phone,
      customerCancelWindowMinutes: order.restaurant.customerCancelWindowMinutes
    },
    table: {
      id: order.table.id,
      tableNumber: order.table.tableNumber
    },
    items: order.items.map((item) => ({
      id: item.id,
      itemName: item.itemName,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toString(),
      totalPrice: item.totalPrice.toString(),
      specialInstruction: item.specialInstruction
    })),
    pendingBillRequest: order.waiterRequests.some((request) => request.type === "BILL_REQUEST" && request.status === "PENDING")
  };
}

export function paymentStatusForOrderStatus(status: OrderStatus, current: PaymentStatus) {
  return status === "PAID" ? PaymentStatus.PAID : current;
}
