import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_FAILURE_LIMIT = 5;
const PUBLIC_ORDER_WINDOW_MS = 5 * 60 * 1000;
const PUBLIC_ORDER_IP_LIMIT = 20;
const PUBLIC_ORDER_TABLE_LIMIT = 5;

type HeaderMap =
  | Headers
  | {
      get?: (name: string) => string | null | undefined;
      [key: string]: string | string[] | undefined | unknown;
    }
  | undefined
  | null;

function headerValue(headers: HeaderMap, name: string) {
  if (!headers) return undefined;
  if (typeof headers.get === "function") return headers.get(name) || undefined;
  const value = (headers as Record<string, unknown>)[name];
  return typeof value === "string" ? value : undefined;
}

export function clientIpFromHeaders(headers: HeaderMap) {
  const forwarded = headerValue(headers, "x-forwarded-for");
  const realIp = headerValue(headers, "x-real-ip");
  return (forwarded?.split(",")[0] || realIp || "unknown").trim().slice(0, 80) || "unknown";
}

export function userAgentFromHeaders(headers: HeaderMap) {
  return headerValue(headers, "user-agent")?.slice(0, 300) || null;
}

export async function isLoginRateLimited(email: string, ipAddress?: string | null) {
  const createdAt = { gte: new Date(Date.now() - LOGIN_WINDOW_MS) };
  const failed = await db.loginAttempt.count({
    where: {
      success: false,
      createdAt,
      OR: [{ email }, ...(ipAddress ? [{ ipAddress }] : [])]
    }
  });
  return failed >= LOGIN_FAILURE_LIMIT;
}

export async function recordLoginAttempt(input: { email: string; ipAddress?: string | null; success: boolean }) {
  await db.loginAttempt
    .create({
      data: {
        email: input.email,
        ipAddress: input.ipAddress || null,
        success: input.success
      }
    })
    .catch(() => undefined);
}

export async function logActivity(input: {
  restaurantId?: string | null;
  userId?: string | null;
  orderId?: string | null;
  action: string;
  description: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  await db.activityLog
    .create({
      data: {
        restaurantId: input.restaurantId || null,
        userId: input.userId || null,
        orderId: input.orderId || null,
        action: input.action,
        description: input.description,
        ipAddress: input.ipAddress || null,
        userAgent: input.userAgent || null
      }
    })
    .catch(() => undefined);
}

export async function publicOrderLimitStatus(input: {
  ipAddress: string;
  restaurantId?: string | null;
  tableNumber?: number | null;
  customerSessionId?: string | null;
}) {
  const createdAt = { gte: new Date(Date.now() - PUBLIC_ORDER_WINDOW_MS) };
  const [ipCount, tableCount, sessionCount] = await Promise.all([
    db.publicOrderAttempt.count({ where: { ipAddress: input.ipAddress, createdAt } }),
    input.restaurantId && input.tableNumber
      ? db.publicOrderAttempt.count({
          where: { restaurantId: input.restaurantId, tableNumber: input.tableNumber, createdAt }
        })
      : Promise.resolve(0),
    input.customerSessionId
      ? db.publicOrderAttempt.count({ where: { customerSessionId: input.customerSessionId, createdAt } })
      : Promise.resolve(0)
  ]);

  return {
    allowed:
      ipCount < PUBLIC_ORDER_IP_LIMIT &&
      tableCount < PUBLIC_ORDER_TABLE_LIMIT &&
      sessionCount < PUBLIC_ORDER_TABLE_LIMIT,
    ipCount,
    tableCount,
    sessionCount
  };
}

export async function recordPublicOrderAttempt(input: {
  ipAddress: string;
  restaurantId?: string | null;
  tableNumber?: number | null;
  customerSessionId?: string | null;
}) {
  await db.publicOrderAttempt
    .create({
      data: {
        ipAddress: input.ipAddress,
        restaurantId: input.restaurantId || null,
        tableNumber: input.tableNumber || null,
        customerSessionId: input.customerSessionId || null
      }
    })
    .catch((error) => {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
        console.error("record public order attempt failed", error);
      }
    });
}
