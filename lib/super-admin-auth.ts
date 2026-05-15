import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { UserRole } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const cookieName = "ordertable_super_admin";
const maxAgeSeconds = 60 * 60 * 12;

type SuperAdminPayload = {
  userId: string;
  exp: number;
};

function secret() {
  return process.env.NEXTAUTH_SECRET || "local-dev-secret-change-before-production-ordertable-pilot";
}

function debugAdminAuth(message: string, details?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[admin-auth] ${message}`, details || {});
  }
}

function base64Url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

function signPayload(payload: SuperAdminPayload) {
  const body = base64Url(JSON.stringify(payload));
  const signature = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function verifyToken(token: string): SuperAdminPayload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = createHmac("sha256", secret()).update(body).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SuperAdminPayload;
    if (!payload.userId || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function createSuperAdminSession(userId: string) {
  const jar = await cookies();
  jar.set(cookieName, signPayload({ userId, exp: Date.now() + maxAgeSeconds * 1000 }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds
  });
}

export async function clearSuperAdminSession() {
  const jar = await cookies();
  jar.set(cookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
  jar.set(cookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: 0
  });
}

export async function getSuperAdminUser() {
  const jar = await cookies();
  const tokens = jar.getAll(cookieName).map((cookie) => cookie.value);
  for (const token of tokens) {
    const payload = verifyToken(token);
    if (!payload) {
      debugAdminAuth("invalid super admin cookie");
      continue;
    }
    const user = await db.user.findUnique({ where: { id: payload.userId } });
    if (user?.role === UserRole.PLATFORM_ADMIN && user.isActive) return user;
    debugAdminAuth("super admin cookie user rejected", {
      userId: payload.userId,
      role: user?.role,
      isActive: user?.isActive
    });
  }

  const session = await getServerSession(authOptions);
  if (session?.user?.role === UserRole.PLATFORM_ADMIN && session.user.isActive !== false) {
    const user = await db.user.findUnique({ where: { id: session.user.id } });
    if (user?.role === UserRole.PLATFORM_ADMIN && user.isActive) return user;
  }

  debugAdminAuth("no valid platform admin session", {
    hasSuperAdminCookie: tokens.length > 0,
    sessionRole: session?.user?.role,
    sessionUserId: session?.user?.id
  });
  return null;
}

export async function requireSuperAdmin() {
  const user = await getSuperAdminUser();
  if (user) return user;

  const session = await getServerSession(authOptions);
  if (session?.user?.role === UserRole.RESTAURANT_MANAGER) {
    debugAdminAuth("restaurant manager attempted admin route", { userId: session.user.id });
    redirect("/dashboard");
  }

  redirect("/super-admin-login?callbackUrl=/admin");
}
