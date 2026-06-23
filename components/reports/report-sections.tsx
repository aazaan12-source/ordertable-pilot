import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { reportRangePresets, type GroupedSalesRow, type ResolvedReportRange } from "@/lib/reports";

type HiddenField = { name: string; value: string };

// Date-range preset controls (Today / Yesterday / T7 / T30 / T90) plus a custom
// "Between" range. Renders as a plain GET form so it works without client JS and
// keeps any other active filters via hidden fields.
export function ReportRangeControls({
  range,
  hiddenFields = [],
  className
}: {
  range: ResolvedReportRange;
  hiddenFields?: HiddenField[];
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Report Period</CardTitle>
        <p className="text-sm text-muted-foreground">Pick a quick range, or choose custom dates and press Between.</p>
      </CardHeader>
      <CardContent>
        <form className="space-y-4">
          {hiddenFields.map((field) => (
            <input key={field.name} type="hidden" name={field.name} value={field.value} />
          ))}

          <div className="flex flex-wrap gap-2">
            {reportRangePresets
              .filter((preset) => preset.key !== "custom")
              .map((preset) => (
                <Button
                  key={preset.key}
                  type="submit"
                  name="range"
                  value={preset.key}
                  variant={range.key === preset.key ? "default" : "outline"}
                >
                  {preset.label}
                </Button>
              ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="text-sm font-semibold">
              From date
              <input
                type="date"
                name="from"
                defaultValue={range.key === "custom" ? range.fromStr : ""}
                className="mt-1 block h-10 w-full rounded-md border bg-white px-3 text-sm"
              />
            </label>
            <label className="text-sm font-semibold">
              To date
              <input
                type="date"
                name="to"
                defaultValue={range.key === "custom" ? range.toStr : ""}
                className="mt-1 block h-10 w-full rounded-md border bg-white px-3 text-sm"
              />
            </label>
            <Button type="submit" name="range" value="custom" variant={range.key === "custom" ? "default" : "outline"}>
              Between
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// Renders a category-wise or department-wise sales breakdown table.
export function GroupedSalesTable({
  title,
  subtitle,
  groupLabel,
  rows,
  emptyText
}: {
  title: string;
  subtitle?: string;
  groupLabel: string;
  rows: GroupedSalesRow[];
  emptyText: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-3">{groupLabel}</th>
                <th className="py-2 pr-3 text-right">Qty sold</th>
                <th className="py-2 pr-3 text-right">Orders</th>
                <th className="py-2 pr-3 text-right">Revenue</th>
                <th className="py-2 text-right">Share</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.name} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-semibold">{row.name}</td>
                  <td className="py-2 pr-3 text-right">{row.quantity}</td>
                  <td className="py-2 pr-3 text-right">{row.orders}</td>
                  <td className="py-2 pr-3 text-right font-semibold">{formatCurrency(row.revenue)}</td>
                  <td className="py-2 text-right">{row.share.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? <p className="rounded-md border bg-white p-6 text-center text-muted-foreground">{emptyText}</p> : null}
      </CardContent>
    </Card>
  );
}
