import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { z } from "zod";
import {
  createAdminPasswordResetOtp,
  findPlatformAdminForRecovery,
  logRecoveryEvent,
  normalizeRecoveryEmail,
  normalizeRecoveryPhone,
  RECOVERY_OTP_EXPIRY_MINUTES,
  sendRecoveryMessage
} from "@/lib/admin-recovery";
import { clientIpFromHeaders, userAgentFromHeaders } from "@/lib/security";
import { rateLimit } from "@/lib/rate-limit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const passwordResetSchema = z.object({
  adminEmail: z.string().email(),
  channel: z.enum(["EMAIL", "SMS"]),
  recoveryDestination: z.string().min(3).max(120)
});

const loginIdSchema = z.object({
  channel: z.enum(["EMAIL", "SMS"]),
  recoveryDestination: z.string().min(3).max(120)
});

async function requestPasswordReset(formData: FormData) {
  "use server";
  const requestHeaders = await headers();
  const ipAddress = clientIpFromHeaders(requestHeaders);
  const userAgent = userAgentFromHeaders(requestHeaders);
  if (!rateLimit(`admin-recovery-reset:${ipAddress}`, 5, 15 * 60_000).allowed) {
    redirect("/super-admin-login/recover?status=limited");
  }

  const parsed = passwordResetSchema.safeParse({
    adminEmail: normalizeRecoveryEmail(formData.get("adminEmail")),
    channel: String(formData.get("channel") || "EMAIL"),
    recoveryDestination: String(formData.get("recoveryDestination") || "").trim()
  });
  if (!parsed.success) redirect("/super-admin-login/recover?status=invalid");

  const destination =
    parsed.data.channel === "SMS"
      ? normalizeRecoveryPhone(parsed.data.recoveryDestination)
      : normalizeRecoveryEmail(parsed.data.recoveryDestination);
  const user = await findPlatformAdminForRecovery({
    adminEmail: parsed.data.adminEmail,
    channel: parsed.data.channel,
    destination
  });

  if (!user) {
    await logRecoveryEvent({
      action: "SUPER_ADMIN_PASSWORD_RECOVERY_FAILED",
      description: "Password recovery requested with unmatched admin/recovery contact",
      ipAddress,
      userAgent
    });
    redirect("/super-admin-login/recover?status=sent");
  }

  const { otp, token } = await createAdminPasswordResetOtp({
    userId: user.id,
    channel: parsed.data.channel,
    destination,
    ipAddress,
    userAgent
  });
  const delivery = await sendRecoveryMessage({
    channel: parsed.data.channel,
    to: destination,
    subject: "OrderTable Super Admin password reset OTP",
    otp,
    message: `Your OrderTable Super Admin password reset OTP is ${otp}. It expires in ${RECOVERY_OTP_EXPIRY_MINUTES} minutes.`
  });
  await logRecoveryEvent({
    userId: user.id,
    action: "SUPER_ADMIN_PASSWORD_OTP_SENT",
    description: `Password reset OTP requested by ${parsed.data.channel}; delivery ${delivery.reason}`,
    ipAddress,
    userAgent
  });
  redirect(`/super-admin-login/reset?token=${encodeURIComponent(token)}&delivery=${encodeURIComponent(delivery.reason)}`);
}

async function recoverLoginId(formData: FormData) {
  "use server";
  const requestHeaders = await headers();
  const ipAddress = clientIpFromHeaders(requestHeaders);
  const userAgent = userAgentFromHeaders(requestHeaders);
  if (!rateLimit(`admin-recovery-id:${ipAddress}`, 5, 15 * 60_000).allowed) {
    redirect("/super-admin-login/recover?status=limited");
  }

  const parsed = loginIdSchema.safeParse({
    channel: String(formData.get("channel") || "EMAIL"),
    recoveryDestination: String(formData.get("recoveryDestination") || "").trim()
  });
  if (!parsed.success) redirect("/super-admin-login/recover?status=invalid");

  const destination =
    parsed.data.channel === "SMS"
      ? normalizeRecoveryPhone(parsed.data.recoveryDestination)
      : normalizeRecoveryEmail(parsed.data.recoveryDestination);
  const user = await findPlatformAdminForRecovery({ channel: parsed.data.channel, destination });
  if (user) {
    const delivery = await sendRecoveryMessage({
      channel: parsed.data.channel,
      to: destination,
      subject: "OrderTable Super Admin login ID",
      message: `Your OrderTable Super Admin login email is ${user.email}. If you did not request this, secure your recovery contacts immediately.`
    });
    await logRecoveryEvent({
      userId: user.id,
      action: "SUPER_ADMIN_LOGIN_ID_RECOVERY_SENT",
      description: `Login ID recovery requested by ${parsed.data.channel}; delivery ${delivery.reason}`,
      ipAddress,
      userAgent
    });
  } else {
    await logRecoveryEvent({
      action: "SUPER_ADMIN_LOGIN_ID_RECOVERY_FAILED",
      description: "Login ID recovery requested with unmatched recovery contact",
      ipAddress,
      userAgent
    });
  }
  redirect("/super-admin-login/recover?status=sent");
}

export default async function SuperAdminRecoverPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const messages: Record<string, string> = {
    sent: "If the details match the recovery contacts, a message has been sent.",
    invalid: "Please enter valid recovery details.",
    limited: "Too many recovery attempts. Please wait and try again."
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-5xl gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Reset Super Admin Password</CardTitle>
            <p className="text-sm text-muted-foreground">Enter the admin login email plus the saved recovery email or mobile number.</p>
          </CardHeader>
          <CardContent>
            <form action={requestPasswordReset} className="space-y-3">
              <Input name="adminEmail" type="email" placeholder="Super admin login email" required />
              <select name="channel" className="h-10 w-full rounded-md border bg-white px-3 text-sm" defaultValue="EMAIL">
                <option value="EMAIL">Send OTP to alternate email</option>
                <option value="SMS">Send OTP to mobile</option>
              </select>
              <Input name="recoveryDestination" placeholder="Recovery email or mobile number" required />
              <Button className="w-full">Send Password OTP</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Forgot Login ID</CardTitle>
            <p className="text-sm text-muted-foreground">Send the super admin login email to the saved recovery contact.</p>
          </CardHeader>
          <CardContent>
            <form action={recoverLoginId} className="space-y-3">
              <select name="channel" className="h-10 w-full rounded-md border bg-white px-3 text-sm" defaultValue="EMAIL">
                <option value="EMAIL">Send login ID to alternate email</option>
                <option value="SMS">Send login ID to mobile</option>
              </select>
              <Input name="recoveryDestination" placeholder="Recovery email or mobile number" required />
              <Button className="w-full" variant="outline">Send Login ID</Button>
            </form>
          </CardContent>
        </Card>

        {status ? (
          <p className="rounded-md border bg-muted p-3 text-sm font-medium md:col-span-2">
            {messages[status] || messages.sent}
          </p>
        ) : null}
        <Link href="/super-admin-login" className="text-center text-sm font-semibold text-primary hover:underline md:col-span-2">
          Back to Super Admin Login
        </Link>
      </div>
    </main>
  );
}
