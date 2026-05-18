import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { logRecoveryEvent, RECOVERY_MAX_ATTEMPTS } from "@/lib/admin-recovery";
import { clientIpFromHeaders, userAgentFromHeaders } from "@/lib/security";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";

const schema = z.object({
  token: z.string().min(20).max(200),
  otp: z.string().regex(/^\d{6}$/),
  password: z.string().min(8).max(120),
  passwordConfirm: z.string().min(8).max(120)
});

async function resetSuperAdminPassword(formData: FormData) {
  "use server";
  const requestHeaders = await headers();
  const ipAddress = clientIpFromHeaders(requestHeaders);
  const userAgent = userAgentFromHeaders(requestHeaders);
  const parsed = schema.safeParse({
    token: String(formData.get("token") || ""),
    otp: String(formData.get("otp") || "").trim(),
    password: String(formData.get("password") || ""),
    passwordConfirm: String(formData.get("passwordConfirm") || "")
  });
  if (!parsed.success || parsed.data.password !== parsed.data.passwordConfirm) {
    redirect(`/super-admin-login/reset?token=${encodeURIComponent(String(formData.get("token") || ""))}&error=invalid`);
  }

  const record = await db.adminPasswordResetOtp.findUnique({
    where: { token: parsed.data.token },
    include: { user: true }
  });
  if (
    !record ||
    record.usedAt ||
    record.expiresAt < new Date() ||
    record.attempts >= RECOVERY_MAX_ATTEMPTS ||
    record.user.role !== "PLATFORM_ADMIN" ||
    !record.user.isActive
  ) {
    redirect("/super-admin-login/recover?status=invalid");
  }

  const validOtp = await bcrypt.compare(parsed.data.otp, record.otpHash);
  if (!validOtp) {
    await db.adminPasswordResetOtp.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    await logRecoveryEvent({
      userId: record.userId,
      action: "SUPER_ADMIN_PASSWORD_OTP_FAILED",
      description: "Invalid password reset OTP entered",
      ipAddress,
      userAgent
    });
    redirect(`/super-admin-login/reset?token=${encodeURIComponent(parsed.data.token)}&error=otp`);
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await db.$transaction([
    db.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    db.adminPasswordResetOtp.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    db.activityLog.create({
      data: {
        userId: record.userId,
        action: "SUPER_ADMIN_PASSWORD_RESET",
        description: "Platform admin password reset by recovery OTP",
        ipAddress,
        userAgent
      }
    })
  ]);

  redirect("/super-admin-login?reset=1");
}

export default async function SuperAdminResetPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string; error?: string; delivery?: string }>;
}) {
  const { token = "", error, delivery } = await searchParams;
  const canReset = token.length > 20;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Enter Recovery OTP</CardTitle>
          <p className="text-sm text-muted-foreground">Use the 6-digit OTP sent to the saved recovery contact, then set a new strong password.</p>
        </CardHeader>
        <CardContent>
          {delivery === "provider-not-configured" ? (
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              OTP delivery provider is not configured yet. Add `RECOVERY_EMAIL_WEBHOOK_URL` or `RECOVERY_SMS_WEBHOOK_URL` in Vercel to send real recovery messages.
            </div>
          ) : null}
          {!canReset ? (
            <p className="rounded-md border bg-muted p-3 text-sm">Invalid recovery token. Please request a new OTP.</p>
          ) : (
            <form action={resetSuperAdminPassword} className="space-y-3">
              <input type="hidden" name="token" value={token} />
              <Input name="otp" inputMode="numeric" maxLength={6} placeholder="6-digit OTP" required />
              <PasswordInput name="password" placeholder="New password, minimum 8 characters" minLength={8} required />
              <PasswordInput name="passwordConfirm" placeholder="Confirm new password" minLength={8} required />
              {error ? <p className="text-sm text-destructive">OTP or password details are invalid. Please try again.</p> : null}
              <Button className="w-full">Reset Password</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
