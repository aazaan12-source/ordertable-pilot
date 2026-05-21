import { AdminBreadcrumbs } from "@/components/admin/admin-breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { demoIncompleteSimulationMs, demoStageLabels, expireStaleDemoSimulationRuns } from "@/lib/demo-simulation-analytics";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/permissions";
import { formatCurrency, formatPkDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  await requirePlatformAdmin();
  await expireStaleDemoSimulationRuns();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    totalRuns,
    completedRuns,
    partialRuns,
    activeRuns,
    completedToday,
    partialToday,
    completedRevenue,
    partialByStage,
    activeByStage,
    recentPartialRuns,
    activeIncompleteRuns
  ] = await Promise.all([
    db.demoSimulationRun.count(),
    db.demoSimulationRun.count({ where: { status: "COMPLETED" } }),
    db.demoSimulationRun.count({ where: { status: "PARTIAL" } }),
    db.demoSimulationRun.count({ where: { status: "IN_PROGRESS" } }),
    db.demoSimulationRun.count({ where: { status: "COMPLETED", completedAt: { gte: today } } }),
    db.demoSimulationRun.count({ where: { status: "PARTIAL", partialAt: { gte: today } } }),
    db.demoSimulationRun.aggregate({ where: { status: "COMPLETED" }, _sum: { total: true }, _avg: { total: true } }),
    db.demoSimulationRun.groupBy({ by: ["lastStage"], where: { status: "PARTIAL" }, _count: { _all: true } }),
    db.demoSimulationRun.groupBy({ by: ["lastStage"], where: { status: "IN_PROGRESS" }, _count: { _all: true } }),
    db.demoSimulationRun.findMany({ where: { status: "PARTIAL" }, orderBy: { updatedAt: "desc" }, take: 15 }),
    db.demoSimulationRun.findMany({ where: { status: "IN_PROGRESS" }, orderBy: { expiresAt: "asc" }, take: 15 })
  ]);

  const completionRate = totalRuns > 0 ? Math.round((completedRuns / totalRuns) * 100) : 0;
  const stageRows = partialByStage
    .map((row) => ({ stage: row.lastStage, count: row._count._all }))
    .sort((a, b) => b.count - a.count);
  const activeStageRows = activeByStage
    .map((row) => ({ stage: row.lastStage, count: row._count._all }))
    .sort((a, b) => b.count - a.count);

  return (
    <main className="mx-auto max-w-7xl p-4 lg:p-6">
      <AdminBreadcrumbs items={[{ label: "Analytics" }]} />
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-sm text-muted-foreground">Track live demo interest from the restaurant main page, including fully completed and abandoned simulation runs.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat title="All demo runs" value={totalRuns} note="Orders started from demo QR/order page" />
        <Stat title="Completed to paid" value={completedRuns} note={`${completionRate}% completion rate`} />
        <Stat title="Partial / left halfway" value={partialRuns} note={`${partialToday} became partial today`} />
        <Stat title="Active incomplete" value={activeRuns} note={`Auto-clears after ${Math.round(demoIncompleteSimulationMs / 60000)} minutes`} />
        <Stat title="Completed today" value={completedToday} note="Reached paid today" />
        <Stat title="Demo revenue simulated" value={formatCurrency(completedRevenue._sum.total?.toString() || 0)} note="Completed demo orders only" />
        <Stat title="Average completed demo" value={formatCurrency(completedRevenue._avg.total?.toString() || 0)} note="Interest quality signal" />
        <Stat title="Partial stages tracked" value={stageRows.length} note="Where people leave the flow" />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Where Partial Simulations Stop</CardTitle>
            <p className="text-sm text-muted-foreground">Partial runs are preserved here after the live demo clears them from the public screen.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {stageRows.map((row) => (
              <StageRow key={row.stage} stage={row.stage} count={row.count} total={partialRuns} />
            ))}
            {stageRows.length === 0 ? <p className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">No partial simulation runs recorded yet.</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Incomplete Runs</CardTitle>
            <p className="text-sm text-muted-foreground">These runs are still in progress. If no one continues them, they become partial automatically.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeStageRows.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {activeStageRows.map((row) => <StagePill key={row.stage} stage={row.stage} count={row.count} />)}
              </div>
            ) : null}
            <div className="space-y-2">
              {activeIncompleteRuns.map((run) => (
                <RunRow key={run.id} run={run} mode="active" />
              ))}
              {activeIncompleteRuns.length === 0 ? <p className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">No active incomplete demo runs right now.</p> : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent Partial Demo Runs</CardTitle>
          <p className="text-sm text-muted-foreground">Each row shows the last stage reached before the simulation was left incomplete.</p>
        </CardHeader>
        <CardContent className="space-y-2">
          {recentPartialRuns.map((run) => <RunRow key={run.id} run={run} mode="partial" />)}
          {recentPartialRuns.length === 0 ? <p className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">No partial demo history yet.</p> : null}
        </CardContent>
      </Card>
    </main>
  );
}

function stageLabel(stage: string) {
  return demoStageLabels[stage as keyof typeof demoStageLabels] || stage.replace(/_/g, " ");
}

function Stat({ title, value, note }: { title: string; value: React.ReactNode; note: string }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm text-muted-foreground">{title}</CardTitle></CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  );
}

function StageRow({ stage, count, total }: { stage: string; count: number; total: number }) {
  const percent = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="rounded-md border bg-white p-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <p className="font-bold">{stageLabel(stage)}</p>
        <p className="text-muted-foreground">{count} run{count === 1 ? "" : "s"} - {percent}%</p>
      </div>
      <div className="mt-2 h-2 rounded-full bg-muted">
        <div className="h-2 rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function StagePill({ stage, count }: { stage: string; count: number }) {
  return (
    <div className="rounded-md border bg-white px-3 py-2 text-sm">
      <span className="font-bold">{stageLabel(stage)}</span>
      <span className="ml-2 text-muted-foreground">{count}</span>
    </div>
  );
}

function RunRow({ run, mode }: { run: any; mode: "active" | "partial" }) {
  return (
    <div className="grid gap-2 rounded-md border bg-white p-3 text-sm md:grid-cols-[1fr_auto]">
      <div>
        <p className="font-bold">{run.orderNumber} - Table {run.tableNumber}</p>
        <p className="text-muted-foreground">
          Last stage: {stageLabel(run.lastStage)} - {run.source} - {formatCurrency(run.total.toString())}
        </p>
        <p className="text-xs text-muted-foreground">Started {formatPkDateTime(run.startedAt)} - Last activity {formatPkDateTime(run.lastActivityAt)}</p>
      </div>
      <div className="text-left text-xs text-muted-foreground md:text-right">
        {mode === "active" ? (
          <p>Expires {run.expiresAt ? formatPkDateTime(run.expiresAt) : "soon"}</p>
        ) : (
          <p>Marked partial {run.partialAt ? formatPkDateTime(run.partialAt) : formatPkDateTime(run.updatedAt)}</p>
        )}
        <p>{run.itemCount} item{run.itemCount === 1 ? "" : "s"}</p>
      </div>
    </div>
  );
}
