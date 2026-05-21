import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const superAdminCookieName = "ordertable_super_admin";

function withCallback(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.searchParams.set("callbackUrl", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(url);
}

function base64Url(bytes: ArrayBuffer) {
  const chars = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(chars).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return atob(padded);
}

async function verifySuperAdminCookie(token: string | undefined) {
  if (!token) return false;
  const [body, signature] = token.split(".");
  if (!body || !signature) return false;
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const expected = base64Url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  if (expected !== signature) return false;

  try {
    const payload = JSON.parse(decodeBase64Url(body)) as { userId?: string; exp?: number };
    return Boolean(payload.userId && payload.exp && payload.exp > Date.now());
  } catch {
    return false;
  }
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const role = token?.role;
  const isActive = token?.isActive !== false;

  if (pathname.startsWith("/admin")) {
    const hasSuperAdminCookie = await verifySuperAdminCookie(request.cookies.get(superAdminCookieName)?.value);
    if (hasSuperAdminCookie) return NextResponse.next();
    return withCallback(request, "/login");
  }

  if (pathname.startsWith("/dashboard")) {
    if (role === "RESTAURANT_MANAGER" && isActive && token?.restaurantId) return NextResponse.next();
    return withCallback(request, "/login");
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*"]
};
