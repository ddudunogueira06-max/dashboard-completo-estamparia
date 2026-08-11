import { useMemo, useState } from "react";
import { Card, DataTable, StatusBadge, type Column } from "./ui";
import { buildFppCalc, fmtBrDate, secToHms, type FppCalc, type DobraFpp, type RgCalc } from "@/lib/dobra";
import { applyFilters, FiltersBar, type DobraFilters } from "./filters";
import { X } from "lucide-react";

const PRAZO_CLS: Record<string, string> = {
  Atrasada: "text-destructive font-semibold",
  Hoje: "text-accent font-semibold",
  "Amanhã": "text-warning font-medium",
  "Dentro do prazo": "text-[var(--success)]",
  "—": "text-muted-foreground",
};

export function FppsPage({
  rows,
  fpps,
  filters,
  onFilters,
}: {
  rows: RgCalc[];
  fpps: DobraFpp[];
  filters: DobraFilters;
  onFilters: (f: DobraFilters) => void;
}) {
  const [sel, setSel] = useState<FppCalc | null>(null);
  const filtered = useMemo(() => applyFilters(rows, filters), [rows, filters]);
  const list = useMemo(() => {
    const order = ["Atrasada", "Hoje", "Amanhã", "Dentro do prazo", "—"];
    return buildFppCalc(filtered, fpps).sort(
      (a, b) =>
        order.indexOf(a.prazo) - order.indexOf(b.prazo) ||
        (a.dt_planejamento ?? "9999").localeCompare(b.dt_planejamento ?? "9999"),
    );
  }, [filtered, fpps]);

  const cols: Column<FppCalc>[] = [
    { key: "fpp", header: "FPP/FPG", cell: (r) => <span className="font-medium text-primary">{r.fpp}</span>, sortValue: (r) => r.fpp },
    { key: "produto", header: "Produto", cell: (r) => r.produto ?? "—", sortValue: (r) => r.produto ?? "" },
    { key: "plan", header: "Data plan.", cell: (r) => fmtBrDate(r.dt_planejamento), sortValue: (r) => r.dt_planejamento ?? "" },
    { key: "tempo", header: "Tempo estimado", cell: (r) => <span className="tabular-nums">{secToHms(r.tempoTotalSeg)}</span>, sortValue: (r) => r.tempoTotalSeg },
    { key: "total", header: "RGs", cell: (r) => r.total, sortValue: (r) => r.total },
    { key: "concl", header: "Concluídas", cell: (r) => <span className="text-[var(--success)]">{r.concluidas}</span>, sortValue: (r) => r.concluidas },
    { key: "prod", header: "Em produção", cell: (r) => <span className="text-primary">{r.emProducao}</span>, sortValue: (r) => r.emProducao },
    { key: "disp", header: "Disponíveis", cell: (r) => <span className="text-accent">{r.disponiveis}</span>, sortValue: (r) => r.disponiveis },
    { key: "agu", header: "Aguardando", cell: (r) => r.aguardando, sortValue: (r) => r.aguardando },
    { key: "tc", header: "Tempo concluído", cell: (r) => <span className="tabular-nums">{secToHms(r.tempoConcluidoSeg)}</span>, sortValue: (r) => r.tempoConcluidoSeg },
    { key: "tr", header: "Tempo restante", cell: (r) => <span className="tabular-nums text-accent">{secToHms(r.tempoRestanteSeg)}</span>, sortValue: (r) => r.tempoRestanteSeg },
    {
      key: "pct",
      header: "% conclusão",
      cell: (r) => (
        <div className="flex items-center gap-2 min-w-[110px]">
          <div className="h-1.5 flex-1 rounded bg-secondary overflow-hidden">
            <div className="h-full bg-[var(--success)]" style={{ width: `${r.pctConcluido}%` }} />
          </div>
          <span className="tabular-nums text-xs">{r.pctConcluido.toFixed(0)}%</span>
        </div>
      ),
      sortValue: (r) => r.pctConcluido,
    },
    { key: "prazo", header: "Prazo", cell: (r) => <span className={PRAZO_CLS[r.prazo]}>{r.prazo}</span>, sortValue: (r) => r.prazo },
  ];

  const detalhe = sel ? filtered.filter((r) => r.fpp_key === sel.fpp_key) : [];

  return (
    <div className="p-4 md:p-6 space-y-4">
      <FiltersBar filters={filters} onChange={onFilters} rows={rows} />
      <Card title={`FPPs / FPGs (${list.length})`}>
        <DataTable
          rows={list}
          columns={cols}
          pageSize={20}
          onRowClick={setSel}
          footer={
            <span className="flex flex-wrap gap-x-4 gap-y-1">
              <span>FPPs: <b>{list.length}</b></span>
              <span>RGs: <b>{list.reduce((s, r) => s + r.total, 0)}</b></span>
              <span>Concluídas: <b className="text-[var(--success)]">{list.reduce((s, r) => s + r.concluidas, 0)}</b></span>
              <span>Atrasadas: <b className="text-destructive">{list.filter((r) => r.prazo === "Atrasada").length}</b></span>
              <span>Tempo restante: <b className="tabular-nums text-accent">{secToHms(list.reduce((s, r) => s + r.tempoRestanteSeg, 0))}</b></span>
              <span>Tempo total: <b className="tabular-nums">{secToHms(list.reduce((s, r) => s + r.tempoTotalSeg, 0))}</b></span>
            </span>
          }
        />
      </Card>

      {sel && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" onClick={() => setSel(null)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative w-full max-w-5xl max-h-[85vh] overflow-auto rounded-xl border border-border bg-card"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 border-b border-border sticky top-0 bg-card">
              <div className="min-w-0">
                <div className="font-semibold truncate">{sel.fpp} — {sel.produto ?? "—"}</div>
                <div className="text-xs text-muted-foreground">
                  {sel.total} RGs · {sel.concluidas} concluídas · restante {secToHms(sel.tempoRestanteSeg)} · plan.{" "}
                  {fmtBrDate(sel.dt_planejamento)}
                </div>
              </div>
              <button onClick={() => setSel(null)} className="p-1.5 rounded hover:bg-secondary">
                <X className="size-4" />
              </button>
            </header>
            <DataTable
              rows={detalhe}
              columns={[
                { key: "rg", header: "Nº RG", cell: (r) => r.rg, sortValue: (r) => r.rg },
                { key: "st", header: "Status", cell: (r) => <StatusBadge situacao={r.situacao} atrasada={r.atrasada} /> },
                { key: "cli", header: "Cliente", cell: (r) => r.cliente ?? "—" },
                { key: "tarefa", header: "Tarefa", cell: (r) => r.tarefa_desc ?? "—" },
                { key: "plan", header: "Data plan.", cell: (r) => fmtBrDate(r.data_planejamento) },
                { key: "concl", header: "Conclusão", cell: (r) => fmtBrDate(r.data_conclusao) },
                { key: "est", header: "Tempo/RG", cell: (r) => secToHms(r.tempoEstimadoSeg) },
              ]}
              pageSize={10}
              footer={
                <span className="flex flex-wrap gap-x-4 gap-y-1">
                  <span>RGs: <b>{detalhe.length}</b></span>
                  <span>Concluídas: <b className="text-[var(--success)]">{detalhe.filter((r) => r.situacao === "concluida").length}</b></span>
                  <span>Atrasadas: <b className="text-destructive">{detalhe.filter((r) => r.atrasada).length}</b></span>
                  <span>Tempo estimado: <b className="tabular-nums">{secToHms(detalhe.reduce((s, r) => s + r.tempoEstimadoSeg, 0))}</b></span>
                </span>
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
