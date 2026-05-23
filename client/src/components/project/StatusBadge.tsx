import { Badge } from "@/components/ui/badge";
import type { ProjectStatus } from "@/types";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";

const STATUS_CONFIG: Record<
  ProjectStatus,
  { label: string; variant: "accent" | "success" | "warning" | "danger" | "muted"; icon: typeof Clock; spin?: boolean }
> = {
  PLANNING: { label: "Planning", variant: "accent", icon: Loader2, spin: true },
  GENERATING_ASSETS: { label: "Generating assets", variant: "accent", icon: Loader2, spin: true },
  QUEUED: { label: "Queued", variant: "warning", icon: Clock },
  RENDERING: { label: "Rendering", variant: "accent", icon: Loader2, spin: true },
  DONE: { label: "Done", variant: "success", icon: CheckCircle2 },
  FAILED: { label: "Failed", variant: "danger", icon: XCircle },
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const c = STATUS_CONFIG[status];
  const Icon = c.icon;
  return (
    <Badge variant={c.variant}>
      <Icon size={11} className={c.spin ? "animate-spin" : ""} />
      {c.label}
    </Badge>
  );
}
