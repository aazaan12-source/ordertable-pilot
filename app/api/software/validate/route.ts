import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { appBaseUrl } from "@/lib/site-url";
import { getSoftwareReleasePayload, keyPreview, normalizeLicenseKey } from "@/lib/software-licensing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function clientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null;
}

async function logValidation(input: {
  licenseId?: string;
  licenseKey?: string;
  deviceId?: string | null;
  appVersion?: string | null;
  status: string;
  message: string;
  request: NextRequest;
}) {
  await db.softwareLicenseValidation.create({
    data: {
      licenseId: input.licenseId,
      licenseKeyPreview: input.licenseKey ? keyPreview(input.licenseKey) : null,
      deviceId: input.deviceId || null,
      appVersion: input.appVersion || null,
      status: input.status,
      message: input.message,
      ipAddress: clientIp(input.request),
      userAgent: input.request.headers.get("user-agent")
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const licenseKey = normalizeLicenseKey(body.licenseKey);
    const deviceId = String(body.deviceId || "").trim().slice(0, 160);
    const deviceName = String(body.deviceName || "").trim().slice(0, 120) || null;
    const platform = String(body.platform || "").trim().slice(0, 80) || null;
    const appVersion = String(body.appVersion || "").trim().slice(0, 40) || null;

    if (!licenseKey || !deviceId) {
      await logValidation({ licenseKey, deviceId, appVersion, status: "REJECTED", message: "Missing license key or device ID.", request });
      return NextResponse.json({ ok: false, message: "License key and device ID are required." }, { status: 400 });
    }

    const license = await db.softwareLicense.findUnique({
      where: { licenseKey },
      include: {
        restaurant: { select: { id: true, name: true, branchName: true, slug: true, status: true } },
        devices: { where: { isActive: true } }
      }
    });

    if (!license) {
      await logValidation({ licenseKey, deviceId, appVersion, status: "REJECTED", message: "License key not found.", request });
      return NextResponse.json({ ok: false, message: "License key was not found. Please contact OrderTable support." }, { status: 403 });
    }

    if (license.status !== "ACTIVE") {
      await logValidation({ licenseId: license.id, licenseKey, deviceId, appVersion, status: "REJECTED", message: `License is ${license.status}.`, request });
      return NextResponse.json({ ok: false, message: `This software license is ${license.status.toLowerCase()}. Please contact OrderTable support.` }, { status: 403 });
    }

    if (license.expiresAt && license.expiresAt < new Date()) {
      await db.softwareLicense.update({ where: { id: license.id }, data: { status: "EXPIRED" } });
      await logValidation({ licenseId: license.id, licenseKey, deviceId, appVersion, status: "REJECTED", message: "License expired.", request });
      return NextResponse.json({ ok: false, message: "This software license has expired. Please renew it with OrderTable support." }, { status: 403 });
    }

    if (!license.restaurant || license.restaurant.status !== "ACTIVE") {
      await logValidation({ licenseId: license.id, licenseKey, deviceId, appVersion, status: "REJECTED", message: "Restaurant is inactive or missing.", request });
      return NextResponse.json({ ok: false, message: "The restaurant connected with this license is not active." }, { status: 403 });
    }

    const existingDevice = license.devices.find((device) => device.deviceId === deviceId);
    if (!existingDevice && license.devices.length >= license.maxDevices) {
      await logValidation({ licenseId: license.id, licenseKey, deviceId, appVersion, status: "REJECTED", message: "Device limit reached.", request });
      return NextResponse.json({ ok: false, message: `Device limit reached for this license. Allowed devices: ${license.maxDevices}.` }, { status: 403 });
    }

    const now = new Date();
    if (existingDevice) {
      await db.softwareLicenseDevice.update({
        where: { id: existingDevice.id },
        data: { deviceName, platform, appVersion, lastValidatedAt: now }
      });
    } else {
      await db.softwareLicenseDevice.create({
        data: { licenseId: license.id, deviceId, deviceName, platform, appVersion, lastValidatedAt: now }
      });
    }

    await db.softwareLicense.update({ where: { id: license.id }, data: { lastValidatedAt: now } });
    await logValidation({ licenseId: license.id, licenseKey, deviceId, appVersion, status: "ACCEPTED", message: "License accepted.", request });

    return NextResponse.json({
      ok: true,
      message: "License activated.",
      dashboardUrl: `${appBaseUrl()}/dashboard`,
      appBaseUrl: appBaseUrl(),
      restaurant: license.restaurant,
      license: {
        id: license.id,
        clientName: license.clientName,
        keyPreview: license.keyPreview,
        maxDevices: license.maxDevices,
        expiresAt: license.expiresAt
      },
      release: await getSoftwareReleasePayload()
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("SOFTWARE_LICENSE_VALIDATION_FAILED", error);
    return NextResponse.json({ ok: false, message: "Unable to validate license right now." }, { status: 500 });
  }
}
