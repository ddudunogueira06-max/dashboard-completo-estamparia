import type { LucideIcon } from "lucide-react";

interface Props {
  label: string;
  value: string;
  icon: LucideIcon;
  accent?: "primary" | "accent" | "success" | "warning" | "destructive";
  hint?: string;
}

const accentMap = {
  primary: "bg-primary/15 text-primary",
  accent: "bg-accent/15 text-accent",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/15 text-destructive",
};

export function KpiCard({ label, value, icon: Icon, accent = "primary", hint }: Props) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
      <div className={`size-12 rounded-lg grid place-items-center ${accentMap[accent]}`}>
        <Icon className="size-6" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
          {label}
        </div>
        <div className="text-2xl font-bold leading-tight text-foreground truncate">{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-0.5 truncate">{hint}</div>}
      </div>
    </div>
  );
}
