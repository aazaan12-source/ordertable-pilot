import crypto from "crypto";
import { db } from "@/lib/db";
import { appBaseUrl } from "@/lib/site-url";

export const softwareProductName = "OrderTable Manager Desktop";
export const softwareCurrentVersion = "1.0.0";
export const softwareDefaultInstallerName = "OrderTable-Manager-Setup-1.0.0.exe";

export function generateSoftwareLicenseKey() {
  const parts = Array.from({ length: 4 }, () => crypto.randomBytes(3).toString("hex").toUpperCase());
  return `OT-${parts.join("-")}`;
}

export function keyPreview(licenseKey: string) {
  const clean = licenseKey.trim().toUpperCase();
  return clean.length <= 8 ? clean : `${clean.slice(0, 6)}...${clean.slice(-4)}`;
}

export function normalizeLicenseKey(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

export function defaultSoftwareDownloadUrl() {
  return `${appBaseUrl()}/software/${softwareDefaultInstallerName}`;
}

export async function getPublishedSoftwareRelease() {
  const release = await db.softwareRelease.findFirst({
    where: { isPublished: true },
    orderBy: { createdAt: "desc" }
  });
  if (release) return release;
  return null;
}

export async function getSoftwareReleasePayload() {
  const release = await getPublishedSoftwareRelease();
  if (!release) {
    return {
      available: false,
      productName: softwareProductName,
      version: softwareCurrentVersion,
      downloadUrl: defaultSoftwareDownloadUrl(),
      fileName: softwareDefaultInstallerName,
      releaseNotes: "Desktop installer will be available after the platform team publishes a release."
    };
  }
  return {
    available: true,
    productName: softwareProductName,
    version: release.version,
    title: release.title,
    downloadUrl: release.downloadUrl,
    fileName: release.fileName || softwareDefaultInstallerName,
    checksum: release.checksum,
    minSupportedVersion: release.minSupportedVersion,
    releaseNotes: release.releaseNotes
  };
}

