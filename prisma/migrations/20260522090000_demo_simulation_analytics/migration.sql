CREATE TYPE "DemoSimulationRunStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'PARTIAL');

CREATE TABLE "DemoSimulationRun" (
    "id" TEXT NOT NULL,
    "session" TEXT NOT NULL,
    "demoOrderId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "tableNumber" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "lastStage" TEXT NOT NULL,
    "status" "DemoSimulationRunStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "partialAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemoSimulationRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DemoSimulationRun_demoOrderId_key" ON "DemoSimulationRun"("demoOrderId");
CREATE INDEX "DemoSimulationRun_session_idx" ON "DemoSimulationRun"("session");
CREATE INDEX "DemoSimulationRun_status_startedAt_idx" ON "DemoSimulationRun"("status", "startedAt");
CREATE INDEX "DemoSimulationRun_lastStage_idx" ON "DemoSimulationRun"("lastStage");
CREATE INDEX "DemoSimulationRun_expiresAt_idx" ON "DemoSimulationRun"("expiresAt");
