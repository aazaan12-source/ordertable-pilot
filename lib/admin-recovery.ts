import bcrypt from "bcryptjs";
import { randomBytes, randomInt } from "crypto";
import { UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/security";

export const RECOVERY_OTP_EXPIRY_MINUTES = 10;
export const RECOVERY_MAX_ATTEMPTS = 5;

export function normalizeRecoveryEmail(value: FormDataEntryValue | string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

export function normalizeRecoveryPhone(value: FormDataEntryValue | string | null | undefined) {
  return String(value || "").replace(/[^\d+]/g, "").trim();
}

export function maskEmail(email?: string | null) {
  if (!email) return "Not configured";
  const [name, domain] = email.split("@");
  if (!domain) return "Configured";
  return `${name.slice(0, 2)}***@${domain}`;
}

export function maskPhone(phone?: string | null) {
  if (!phone) return "Not configured";
  return `${phone.slice(0, 3)}***${phone.slice(-3)}`;
}

export async function findPlatformAdminForRecovery(input: {
  adminEmail?: string | null;
  channel: string;
  destination: string;
}) {
  const destination =
    input.channel === "SMS" ? normalizeRecoveryPhone(input.destination) : normalizeRecoveryEmail(input.destination);
  if (!destination) return null;

  return db.user.findFirst({
    where: {
      role: UserRole.PLATFORM_ADMIN,
      isActive: true,
      ...(input.adminEmail ? { email: normalizeRecoveryEmail(input.adminEmail) } : {}),
      ...(input.channel === "SMS" ? { recoveryPhone: destination } : { recoveryEmail: destination })
    }
  });
}

export async function createAdminPasswordResetOtp(input: {
  userId: string;
  channel: string;
  destination: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const otp = String(randomInt(100000, 999999));
  const token = randomBytes(32).toString("base64url");
  const otpHash = await bcrypt.hash(otp, 12);
  const expiresAt = new Date(Date.now() + RECOVERY_OTP_EXPIRY_MINUTES * 60_000);

  await db.adminPasswordResetOtp.updateMany({
    where: { userId: input.userId, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() }
  });

  await db.adminPasswordResetOtp.create({
    data: {
      userId: input.userId,
      token,
      otpHash,
      channel: input.channel,
      destination: input.destination,
      expiresAt,
      ipAddress: input.ipAddress || null,
      userAgent: input.userAgent || null
    }
  });

  return { otp, token, expiresAt };
}

export async function sendRecoveryMessage(input: {
  channel: string;
  to: string;
  subject: string;
  message: string;
  otp?: string;
}) {
  const webhook =
    input.channel === "SMS" ? process.env.RECOVERY_SMS_WEBHOOK_URL : process.env.RECOVERY_EMAIL_WEBHOOK_URL;
  const secret = process.env.RECOVERY_WEBHOOK_SECRET;

  if (!webhook) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[admin-recovery] delivery provider missing", {
        channel: input.channel,
        to: input.to,
        subject: input.subject,
        otp: input.otp
      });
    }
    return { delivered: false, reason: "provider-not-configured" };
  }

  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { Authorization: `Bearer ${secret}` } : {})
      },
      body: JSON.stringify({
        channel: input.channel,
        to: input.to,
        subject: input.subject,
        message: input.message,
        otp: input.otp,
        app: "OrderTable Pilot"
      })
    });
    return { delivered: response.ok, reason: response.ok ? "sent" : `provider-${response.status}` };
  } catch (error) {
    console.error("[admin-recovery] delivery failed", error);
    return { delivered: false, reason: "provider-error" };
  }
}

export async function logRecoveryEvent(input: {
  userId?: string | null;
  action: string;
  description: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  await logActivity({
    userId: input.userId || null,
    action: input.action,
    description: input.description,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent
  });
}
