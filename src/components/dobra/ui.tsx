import { useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { isDobrada, SITUACAO_LABEL, type Situacao } from "@/lib/dobra";

export function Card({
  title,
  right,
  children,
  className,
}: {
  title?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-border bg-card overflow-hidden", className)}>
      {(title || right) && (
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 border-b border-border">
          <h2 className="truncate text-sm font-semibold uppercase tracking-wide">{title}</h2>
          {right}
        </header>
      )}
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export function Kpi({
  label,
  value,
  sub,
  tone = "default",
  onClick,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "default" | "primary" | "accent" | "success" | "destructive";
  onClick?: () => void;
}) {
  const tones: Record<string, string> = {
    default: "bg-card",
    primary: "bg-primary/10 border-primary/30",
    accent: "bg-accent/10 border-accent/40",
    success: "bg-[var(--success)]/10 border-[var(--success)]/40",
    destructive: "bg-destructive/10 border-destructive/40",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "text-left rounded-xl border border-border p-4 min-w-0 transition-colors",
        tones[tone],
        onClick && "hover:border-primary/60 cursor-pointer",
      )}
    >
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground truncate">{label}</div>
      <div className="text-2xl font-bold mt-1 truncate tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</div>}
    </button>
  );
}

const SIT_STYLE: Record<Situacao | "atrasada", string> = {
  concluida: "bg-[var(--success)]/15 text-[var(--success)] border-[var(--success)]/40",
  logistica: "bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/30",
  separacao: "bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/30",
  em_producao: "bg-primary/15 text-primary border-primary/40",
  disponivel: "bg-accent/15 text-accent border-accent/40",
  aguardando: "bg-muted text-muted-foreground border-border",
  atrasada: "bg-destructive/15 text-destructive border-destructive/40",
};

export function StatusBadge({ situacao, atrasada }: { situacao: Situacao; atrasada?: boolean }) {
  const key = atrasada && !isDobrada(situacao) ? "atrasada" : situacao;
  const label = key === "atrasada" ? "Atrasada" : SITUACAO_LABEL[situacao];
  return (
    <span className={cn("inline-block rounded-md border px-2 py-0.5 text-[11px] font-semibold", SIT_STYLE[key])}>
      {label}
    </span>
  );
}

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  className?: string;
}

export function DataTable<T>({
  rows,
  columns,
  pageSize: initialPageSize = 15,
  onRowClick,
  footer,
  rowClass,
  empty = "Nenhum registro encontrado.",
}: {
  rows: T[];
  columns: Column<T>[];
  pageSize?: number;
  onRowClick?: (row: T) => void;
  footer?: ReactNode;
  /** classe extra por linha (ex.: destaque de atraso) */
  rowClass?: (row: T) => string | undefined;
  empty?: string;
}) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    return [...rows].sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      if (va === vb) return 0;
      return (va > vb ? 1 : -1) * sort.dir;
    });
  }, [rows, sort, columns]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const cur = Math.min(page, pages - 1);
  const slice = sorted.slice(cur * pageSize, cur * pageSize + pageSize);

  return (
    <div className="min-w-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-secondary/60 text-muted-foreground">
              {columns.map((c) => (
                <th
                  key={c.key}
                  onClick={() =>
                    c.sortValue &&
                    setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === 1 ? -1 : 1 } : { key: c.key, dir: 1 }))
                  }
                  className={cn(
                    "text-left font-semibold text-[11px] uppercase tracking-wide px-3 py-2 whitespace-nowrap",
                    c.sortValue && "cursor-pointer select-none hover:text-foreground",
                    c.className,
                  )}
                >
                  <span className="inline-flex items-center gap-1">
                    {c.header}
                    {c.sortValue && <ChevronsUpDown className="size-3 opacity-50" />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-muted-foreground">
                  {empty}
                </td>
              </tr>
            )}
            {slice.map((row, i) => (
              <tr
                key={i}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  "border-t border-border",
                  onRowClick && "cursor-pointer hover:bg-secondary/50",
                  i % 2 === 1 && "bg-secondary/20",
                  rowClass?.(row),
                )}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn("px-3 py-2 whitespace-nowrap", c.className)}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 border-t border-border text-xs text-muted-foreground">
        <div className="min-w-0 truncate">{footer ?? `${sorted.length} registro(s)`}</div>
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(0);
            }}
            className="bg-input border border-border rounded-md px-2 py-1"
          >
            {[10, 15, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}/pág
              </option>
            ))}
          </select>
          <button
            onClick={() => setPage(Math.max(0, cur - 1))}
            disabled={cur === 0}
            className="p-1 rounded border border-border disabled:opacity-40"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <span className="tabular-nums">
            {cur + 1}/{pages}
          </span>
          <button
            onClick={() => setPage(Math.min(pages - 1, cur + 1))}
            disabled={cur >= pages - 1}
            className="p-1 rounded border border-border disabled:opacity-40"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export const inputCls =
  "w-full bg-input border border-border rounded-md px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring/40";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}
