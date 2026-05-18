import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { createSuperAdminSession } from "@/lib/super-admin-auth";
import { clientIpFromHeaders, isLoginRateLimited, logActivity, recordLoginAttempt } from "@/lib/security";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";

async function loginSuperAdmin(formData: FormData) {
  "use server";
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const callbackUrl = String(formData.get("callbackUrl") || "/admin");
  const requestHeaders = await headers();
  const ipAddress = clientIpFromHeaders(requestHeaders);
  const failureUrl = `/super-admin-login?error=1&callbackUrl=${encodeURIComponent(callbackUrl.startsWith("/admin") ? callbackUrl : "/admin")}`;
  if (await isLoginRateLimited(email, ipAddress)) {
    await recordLoginAttempt({ email, ipAddress, success: false });
    redirect(failureUrl);
  }
  const user = await db.user.findUnique({ where: { email } });
  if (!user || user.role !== "PLATFORM_ADMIN" || !user.isActive) {
    await recordLoginAttempt({ email, ipAddress, success: false });
    redirect(failureUrl);
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
    redirect(failureUrl);
  }
  await recordLoginAttempt({ email, ipAddress, success: true });
  await logActivity({
    userId: user.id,
    action: "LOGIN_SUCCESS",
    description: "Platform admin logged in",
    ipAddress
  });
  await createSuperAdminSession(user.id);
  redirect(callbackUrl.startsWith("/admin") ? callbackUrl : "/admin");
}

export default async function SuperAdminLoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string; reset?: string }>;
}) {
  const { error, callbackUrl = "/admin", reset } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Super Admin Login</CardTitle>
          <p className="text-sm text-muted-foreground">Independent platform admin session for `/admin`.</p>
        </CardHeader>
        <CardContent>
          <form action={loginSuperAdmin} className="space-y-4">
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
            <Input name="email" type="email" placeholder="Email" required />
            <PasswordInput name="password" placeholder="Password" required />
            {error ? <p className="text-sm text-destructive">Invalid email or password.</p> : null}
            {reset ? <p className="text-sm font-medium text-green-700">Password reset successfully. Sign in with the new password.</p> : null}
            <Button className="w-full" size="lg">Sign in as Super Admin</Button>
          </form>
          <p className="mt-5 rounded-md bg-muted p-3 text-xs text-muted-foreground">
            Use the platform admin credentials configured for this deployment.
          </p>
          <Link href="/super-admin-login/recover" className="mt-3 block text-center text-sm font-semibold text-primary hover:underline">
            Forgot login ID or password?
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
