import { Badge } from "@/components/ui/badge";

const styles: Record<string, string> = {
  PENDING: "bg-orange-100 text-orange-800",
  ACCEPTED: "bg-blue-100 text-blue-800",
  PREPARING: "bg-amber-100 text-amber-800",
  READY: "bg-emerald-100 text-emerald-800",
  SERVED: "bg-slate-100 text-slate-800",
  BILL_REQUESTED: "bg-purple-100 text-purple-800",
  PAID: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800"
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge className={styles[status] || "bg-muted text-foreground"}>{status.replaceAll("_", " ")}</Badge>;
}
