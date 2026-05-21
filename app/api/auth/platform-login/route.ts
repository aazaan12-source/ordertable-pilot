import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { createSuperAdminSession } from "@/lib/super-admin-auth";
import { clientIpFromHeaders, isLoginRateLimited, logActivity, recordLoginAttempt } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const callbackUrl = String(body.callbackUrl || "/admin");
    if (!email || !password) {
      return NextResponse.json({ handled: false });
    }

    const user = await db.user.findUnique({ where: { email } });
    if (!user || user.role !== UserRole.PLATFORM_ADMIN) {
      return NextResponse.json({ handled: false });
    }

    const ipAddress = clientIpFromHeaders(request.headers);
    if (await isLoginRateLimited(email, ipAddress)) {
      await recordLoginAttempt({ email, ipAddress, success: false });
      return NextResponse.json({ handled: true, error: "Invalid email or password." }, { status: 401 });
    }

    if (!user.isActive) {
      await recordLoginAttempt({ email, ipAddress, success: false });
      return NextResponse.json({ handled: true, error: "Invalid email or password." }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      await recordLoginAttempt({ email, ipAddress, success: false });
      await logActivity({
        userId: user.id,
        action: "LOGIN_FAILED",
        description: "Failed platform admin login attempt",
        ipAddress
      });
      return NextResponse.json({ handled: true, error: "Invalid email or password." }, { status: 401 });
    }

    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => undefined);
    await recordLoginAttempt({ email, ipAddress, success: true });
    await logActivity({
      userId: user.id,
      action: "LOGIN_SUCCESS",
      description: "Platform admin logged in",
      ipAddress
    });
    await createSuperAdminSession(user.id);
    return NextResponse.json({
      handled: true,
      role: UserRole.PLATFORM_ADMIN,
      redirectTo: callbackUrl.startsWith("/admin") ? callbackUrl : "/admin"
    });
  } catch (error) {
    console.error("platform login failed", error);
    return NextResponse.json({ handled: true, error: "Invalid email or password." }, { status: 401 });
  }
}
