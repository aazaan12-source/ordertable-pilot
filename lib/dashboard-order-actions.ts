"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { OrderStatus, PaymentMethod, PaymentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getManagerRestaurant } from "@/lib/permissions";
import { nextOrderNumber, nextTableStatusAfterClosing, tableStatusByOrder } from "@/lib/order-utils";
import { calculateTotalsFromOrderItems, toNumber } from "@/lib/pricing";

function text(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function num(formData: FormData, key: string, fallback = 0) {
  const value = Number(formData.get(key));
  return Number.isFinite(value) ? value : fallback;
}

type DraftItem = {
  menuItemId: string | null;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  specialInstruction: string | null;
  addedAfterInitialOrder?: boolean;
};

async function buildDraftItems(restaurantId: string, formData: FormData, addedAfterInitialOrder = false) {
  const menuItems = await db.menuItem.findMany({ where: { restaurantId, isActive: true }, include: { category: true } });
  const drafts: DraftItem[] = [];
  for (const item of menuItems) {
    const quantity = Math.floor(num(formData, `qty_${item.id}`));
    if (quantity > 0) {
      const unitPrice = toNumber(item.price);
      drafts.push({
        menuItemId: item.id,
        itemName: item.name,
        quantity: Math.min(99, quantity),
        unitPrice,
        totalPrice: unitPrice * Math.min(99, quantity),
        specialInstruction: text(formData, `note_${item.id}`) || null,
        addedAfterInitialOrder
      });
    }
  }

  const customName = text(formData, "customItemName");
  const customQuantity = Math.floor(num(formData, "customQuantity"));
  const customPrice = num(formData, "customUnitPrice");
  if (customName && customQuantity > 0 && customPrice >= 0) {
    drafts.push({
      menuItemId: null,
      itemName: customName,
      quantity: Math.min(99, customQuantity),
      unitPrice: customPrice,
      totalPrice: customPrice * Math.min(99, customQuantity),
      specialInstruction: text(formData, "customInstruction") || null,
      addedAfterInitialOrder
    });
  }
  return drafts;
}

export async function createManualOrder(formData: FormData) {
  const { user, restaurant } = await getManagerRestaurant();
  const tableNumber = Math.floor(num(formData, "tableNumber"));
  const table = await db.restaurantTable.findUnique({
    where: { restaurantId_tableNumber: { restaurantId: restaurant.id, tableNumber } }
  });
  if (!table || table.status === "INACTIVE") return;

  const draftItems = await buildDraftItems(restaurant.id, formData);
  if (draftItems.length === 0) return;
  const discount = num(formData, "discount");
  const totals = calculateTotalsFromOrderItems(draftItems, restaurant.serviceChargePercent, restaurant.taxPercent, discount);
  const orderNumber = await nextOrderNumber(restaurant.id);

  const order = await db.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        restaurantId: restaurant.id,
        tableId: table.id,
        orderNumber,
        source: text(formData, "source") === "WAITER_ENTRY" ? "WAITER_ENTRY" : "MANUAL_DASHBOARD",
        status: "ACCEPTED",
        subtotal: totals.subtotal,
        serviceCharges: totals.serviceCharges,
        tax: totals.tax,
        discount: totals.discount,
        total: totals.total,
        balanceDue: totals.total,
        specialNote: text(formData, "specialNote") || null,
        customerName: text(formData, "customerName") || null,
        customerPhone: text(formData, "customerPhone") || null,
        waiterName: text(formData, "waiterName") || null,
        paymentMethod: (text(formData, "paymentMethod") as PaymentMethod) || null,
        items: { create: draftItems }
      }
    });
    await tx.restaurantTable.update({ where: { id: table.id }, data: { status: "ACTIVE_ORDER" } });
    await tx.activityLog.create({
      data: { restaurantId: restaurant.id, userId: user.id, orderId: created.id, action: "MANUAL_ORDER_CREATED", description: `${created.orderNumber} created for table ${tableNumber}` }
    });
    return created;
  });

  revalidatePath("/dashboard/orders");
  redirect(`/dashboard/orders/${order.id}`);
}

export async function updateDashboardOrder(formData: FormData) {
  const { user, restaurant } = await getManagerRestaurant();
  const orderId = text(formData, "orderId");
  const order = await db.order.findFirst({ where: { id: orderId, restaurantId: restaurant.id }, include: { items: true, table: true } });
  if (!order || order.status === "CANCELLED") return;

  const existingDrafts: DraftItem[] = [];
  for (const item of order.items) {
    const quantity = Math.floor(num(formData, `existing_qty_${item.id}`));
    if (quantity > 0) {
      existingDrafts.push({
        menuItemId: item.menuItemId,
        itemName: text(formData, `existing_name_${item.id}`) || item.itemName,
        quantity: Math.min(99, quantity),
        unitPrice: num(formData, `existing_price_${item.id}`, toNumber(item.unitPrice)),
        totalPrice: num(formData, `existing_price_${item.id}`, toNumber(item.unitPrice)) * Math.min(99, quantity),
        specialInstruction: text(formData, `existing_note_${item.id}`) || null,
        addedAfterInitialOrder: item.addedAfterInitialOrder
      });
    }
  }
  const addedDrafts = await buildDraftItems(restaurant.id, formData, true);
  const allDrafts = [...existingDrafts, ...addedDrafts];
  if (allDrafts.length === 0) return;

  const discount = num(formData, "discount", toNumber(order.discount));
  const servicePercent = num(formData, "serviceChargePercent", toNumber(restaurant.serviceChargePercent));
  const taxPercent = num(formData, "taxPercent", toNumber(restaurant.taxPercent));
  const totals = calculateTotalsFromOrderItems(allDrafts, servicePercent, taxPercent, discount);
  const paymentStatus = (text(formData, "paymentStatus") || order.paymentStatus) as PaymentStatus;
  const paymentMethod = text(formData, "paymentMethod") as PaymentMethod | "";

  await db.$transaction(async (tx) => {
    await tx.orderItem.deleteMany({ where: { orderId: order.id } });
    await tx.order.update({
      where: { id: order.id },
      data: {
        subtotal: totals.subtotal,
        serviceCharges: totals.serviceCharges,
        tax: totals.tax,
        discount: totals.discount,
        total: totals.total,
        paymentStatus,
        paymentMethod: paymentMethod || null,
        paidAt: paymentStatus === "PAID" ? new Date() : order.paidAt,
        amountPaid: paymentStatus === "PAID" ? totals.total : order.amountPaid,
        balanceDue: paymentStatus === "PAID" ? 0 : totals.total,
        specialNote: text(formData, "specialNote") || null,
        customerName: text(formData, "customerName") || null,
        customerPhone: text(formData, "customerPhone") || null,
        waiterName: text(formData, "waiterName") || null,
        items: { create: allDrafts }
      }
    });
    await tx.activityLog.create({
      data: {
        restaurantId: restaurant.id,
        userId: user.id,
        orderId: order.id,
        action: order.status === "PAID" ? "PAID_ORDER_EDITED" : "ORDER_EDITED",
        description: `${order.orderNumber} edited and totals recalculated`
      }
    });
    if (addedDrafts.length > 0) {
      await tx.activityLog.create({
        data: { restaurantId: restaurant.id, userId: user.id, orderId: order.id, action: "ORDER_ITEM_ADDED", description: `${addedDrafts.length} item rows added to ${order.orderNumber}` }
      });
    }
  });

  revalidatePath(`/dashboard/orders/${order.id}`);
  revalidatePath("/dashboard/orders");
  redirect(`/dashboard/orders/${order.id}`);
}

export async function markOrderPaid(formData: FormData) {
  const { user, restaurant } = await getManagerRestaurant();
  const orderId = text(formData, "orderId");
  const paymentMethod = text(formData, "paymentMethod") as PaymentMethod;
  const order = await db.order.findFirst({ where: { id: orderId, restaurantId: restaurant.id } });
  if (!order || order.status === "CANCELLED") return;
  await db.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: { status: "PAID", paymentStatus: "PAID", paymentMethod: paymentMethod || "CASH", paidAt: new Date(), amountPaid: order.total, balanceDue: 0 }
    });
    const activeOrders = await tx.order.findMany({
      where: { tableId: order.tableId, status: { notIn: ["PAID", "CANCELLED"] } },
      orderBy: { createdAt: "desc" }
    });
    await tx.restaurantTable.update({ where: { id: order.tableId }, data: { status: nextTableStatusAfterClosing(activeOrders) } });
    await tx.activityLog.create({ data: { restaurantId: restaurant.id, userId: user.id, orderId: order.id, action: "ORDER_MARKED_PAID", description: `${order.orderNumber} paid by ${paymentMethod || "CASH"}` } });
  });
  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${order.id}`);
}

export async function updateOrderStatusFromDetail(formData: FormData) {
  const { user, restaurant } = await getManagerRestaurant();
  const orderId = text(formData, "orderId");
  const status = text(formData, "status") as OrderStatus;
  const order = await db.order.findFirst({ where: { id: orderId, restaurantId: restaurant.id } });
  if (!order || order.status === "PAID" || order.status === "CANCELLED") return;
  await db.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: {
        status,
        paymentStatus: status === "PAID" ? "PAID" : order.paymentStatus,
        paidAt: status === "PAID" ? new Date() : order.paidAt,
        amountPaid: status === "PAID" ? order.total : order.amountPaid,
        balanceDue: status === "PAID" ? 0 : order.balanceDue,
        cancelledAt: status === "CANCELLED" ? new Date() : order.cancelledAt,
        cancellationReason: status === "CANCELLED" ? "Cancelled by restaurant manager" : order.cancellationReason
      }
    });
    await tx.restaurantTable.update({ where: { id: order.tableId }, data: { status: tableStatusByOrder[status] || "ACTIVE_ORDER" } });
    await tx.activityLog.create({ data: { restaurantId: restaurant.id, userId: user.id, orderId: order.id, action: status === "CANCELLED" ? "ORDER_CANCELLED_BY_MANAGER" : "ORDER_STATUS_UPDATED", description: `${order.orderNumber} changed to ${status}` } });
  });
  revalidatePath(`/dashboard/orders/${order.id}`);
  revalidatePath("/dashboard/orders");
}
