ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "recoveryEmail" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "recoveryPhone" TEXT;

CREATE TABLE IF NOT EXISTS "AdminPasswordResetOtp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminPasswordResetOtp_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AdminPasswordResetOtp_userId_fkey'
  ) THEN
    ALTER TABLE "AdminPasswordResetOtp"
      ADD CONSTRAINT "AdminPasswordResetOtp_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "AdminPasswordResetOtp_token_key" ON "AdminPasswordResetOtp"("token");
CREATE INDEX IF NOT EXISTS "AdminPasswordResetOtp_userId_createdAt_idx" ON "AdminPasswordResetOtp"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "AdminPasswordResetOtp_token_idx" ON "AdminPasswordResetOtp"("token");
CREATE INDEX IF NOT EXISTS "AdminPasswordResetOtp_expiresAt_idx" ON "AdminPasswordResetOtp"("expiresAt");
