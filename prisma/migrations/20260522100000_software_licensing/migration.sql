CREATE TYPE "SoftwareLicenseStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'EXPIRED');

CREATE TABLE "SoftwareRelease" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "downloadUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "checksum" TEXT,
    "releaseNotes" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "minSupportedVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SoftwareRelease_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SoftwareLicense" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT,
    "clientName" TEXT NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "licenseKey" TEXT NOT NULL,
    "keyPreview" TEXT NOT NULL,
    "status" "SoftwareLicenseStatus" NOT NULL DEFAULT 'ACTIVE',
    "maxDevices" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3),
    "notes" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastValidatedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SoftwareLicense_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SoftwareLicenseDevice" (
    "id" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "deviceName" TEXT,
    "platform" TEXT,
    "appVersion" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "firstActivatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastValidatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SoftwareLicenseDevice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SoftwareLicenseValidation" (
    "id" TEXT NOT NULL,
    "licenseId" TEXT,
    "licenseKeyPreview" TEXT,
    "deviceId" TEXT,
    "appVersion" TEXT,
    "status" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SoftwareLicenseValidation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SoftwareLicense_licenseKey_key" ON "SoftwareLicense"("licenseKey");
CREATE INDEX "SoftwareRelease_isPublished_createdAt_idx" ON "SoftwareRelease"("isPublished", "createdAt");
CREATE UNIQUE INDEX "SoftwareRelease_version_key" ON "SoftwareRelease"("version");
CREATE INDEX "SoftwareLicense_restaurantId_idx" ON "SoftwareLicense"("restaurantId");
CREATE INDEX "SoftwareLicense_status_idx" ON "SoftwareLicense"("status");
CREATE INDEX "SoftwareLicense_expiresAt_idx" ON "SoftwareLicense"("expiresAt");
CREATE UNIQUE INDEX "SoftwareLicenseDevice_licenseId_deviceId_key" ON "SoftwareLicenseDevice"("licenseId", "deviceId");
CREATE INDEX "SoftwareLicenseDevice_licenseId_isActive_idx" ON "SoftwareLicenseDevice"("licenseId", "isActive");
CREATE INDEX "SoftwareLicenseDevice_deviceId_idx" ON "SoftwareLicenseDevice"("deviceId");
CREATE INDEX "SoftwareLicenseValidation_licenseId_idx" ON "SoftwareLicenseValidation"("licenseId");
CREATE INDEX "SoftwareLicenseValidation_status_createdAt_idx" ON "SoftwareLicenseValidation"("status", "createdAt");
CREATE INDEX "SoftwareLicenseValidation_deviceId_idx" ON "SoftwareLicenseValidation"("deviceId");

ALTER TABLE "SoftwareLicense" ADD CONSTRAINT "SoftwareLicense_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SoftwareLicense" ADD CONSTRAINT "SoftwareLicense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SoftwareLicenseDevice" ADD CONSTRAINT "SoftwareLicenseDevice_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "SoftwareLicense"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SoftwareLicenseValidation" ADD CONSTRAINT "SoftwareLicenseValidation_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "SoftwareLicense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
