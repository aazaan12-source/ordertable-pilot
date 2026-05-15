import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
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
    path: "/admin",
    maxAge: maxAgeSeconds
  });
}

export async function clearSuperAdminSession() {
  const jar = await cookies();
  jar.set(cookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: 0
  });
}

export async function getSuperAdminUser() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  const user = await db.user.findUnique({ where: { id: payload.userId } });
  if (!user || user.role !== "PLATFORM_ADMIN" || !user.isActive) return null;
  return user;
}

export async function requireSuperAdmin() {
  const user = await getSuperAdminUser();
  if (!user) redirect("/super-admin-login");
  return user;
}
