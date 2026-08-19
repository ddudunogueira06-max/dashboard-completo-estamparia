import { useMemo, useState } from "react";
import { Card, DataTable, StatusBadge, inputCls, type Column } from "./ui";
import { isDobrada, fmtBrDate, secToHms, secToHoraDia, type RgCalc } from "@/lib/dobra";
import { applyFilters, FiltersBar, type DobraFilters } from "./filters";
import { Download } from "lucide-react";

const QUICK = [
  { id: "", label: "Todos" },
  { id: "concluida", label: "Concluído" },
  { id: "dobrada", label: "Já dobradas" },
  { id: "logistica", label: "Logística interna" },
  { id: "separacao", label: "Em separação" },
  { id: "disponivel", label: "Disponíveis para dobrar" },
  { id: "em_producao", label: "Em produção" },
  { id: "aguardando", label: "Aguardando etapa anterior" },
  { id: "atrasada", label: "Atrasados" },
] as const;

export function ControleGeralRgs({
  rows,
  filters,
  onFilters,
}: {
  rows: RgCalc[];
  filters: DobraFilters;
  onFilters: (f: DobraFilters) => void;
}) {
  const [busca, setBusca] = useState("");
  const filtered = useMemo(() => {
    const base = applyFilters(rows, filters);
    if (!busca.trim()) return base;
    const q = busca.toLowerCase();
    return base.filter((r) =>
      [r.rg, r.fpp, r.cliente, r.produto, r.nr_ov, r.operador, r.tarefa_desc]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [rows, filters, busca]);

  const resumo = useMemo(
    () => ({
      total: filtered.length,
      concluidas: filtered.filter((r) => isDobrada(r.situacao)).length,
      emProducao: filtered.filter((r) => r.situacao === "em_producao").length,
      disponiveis: filtered.filter((r) => r.situacao === "disponivel").length,
      aguardando: filtered.filter((r) => r.situacao === "aguardando").length,
      dobradas: filtered.filter((r) => isDobrada(r.situacao)).length,
      atrasadas: filtered.filter((r) => r.atrasada).length,
      fpps: new Set(filtered.map((r) => r.fpp_key).filter(Boolean)).size,
      seg: filtered.reduce((s, r) => s + r.tempoEstimadoSeg, 0),
    }),
    [filtered],
  );

  const cols: Column<RgCalc>[] = [
    { key: "status", header: "Status", cell: (r) => <StatusBadge situacao={r.situacao} atrasada={r.atrasada} /> },
    { key: "rg", header: "Nº RG", cell: (r) => <span className="font-medium">{r.rg}</span>, sortValue: (r) => r.rg },
    { key: "fpp", header: "FPP/FPG", cell: (r) => r.fpp ?? "—", sortValue: (r) => r.fpp ?? "" },
    { key: "cliente", header: "Cliente", cell: (r) => <span className="max-w-[220px] truncate inline-block align-bottom">{r.cliente ?? "—"}</span>, sortValue: (r) => r.cliente ?? "" },
    { key: "ov", header: "Nr. OV", cell: (r) => r.nr_ov ?? "—", sortValue: (r) => r.nr_ov ?? "" },
    { key: "datarg", header: "Data RG", cell: (r) => fmtBrDate(r.data_rg), sortValue: (r) => r.data_rg ?? "" },
    { key: "produto", header: "Produto", cell: (r) => r.produto ?? "—", sortValue: (r) => r.produto ?? "" },
    { key: "item", header: "Item OV", cell: (r) => r.item_ov ?? "—" },
    { key: "tarefa", header: "Tarefa descrição", cell: (r) => r.tarefa_desc ?? "—", sortValue: (r) => r.tarefa_desc ?? "" },
    { key: "op", header: "Operador", cell: (r) => r.operador ?? "—", sortValue: (r) => r.operador ?? "" },
    { key: "maq", header: "Máquina ativa", cell: (r) => r.maquina_ativa ?? "—" },
    { key: "plan", header: "Data planejamento", cell: (r) => fmtBrDate(r.data_planejamento), sortValue: (r) => r.data_planejamento ?? "" },
    { key: "concl", header: "Data conclusão", cell: (r) => fmtBrDate(r.data_conclusao), sortValue: (r) => r.data_conclusao ?? "" },
    { key: "est", header: "Tempo estimado", cell: (r) => <span className="tabular-nums">{secToHms(r.tempoEstimadoSeg)}</span>, sortValue: (r) => r.tempoEstimadoSeg },
    { key: "hora", header: "Hora conclusão", cell: (r) => <span className="tabular-nums">{secToHoraDia(r.horaConclusaoSeg)}</span>, sortValue: (r) => r.horaConclusaoSeg ?? -1 },
  ];

  const exportCsv = () => {
    const head = cols.map((c) => c.header).join(";");
    const body = filtered
      .map((r) =>
        [
          r.situacao,
          r.rg,
          r.fpp ?? "",
          r.cliente ?? "",
          r.nr_ov ?? "",
          fmtBrDate(r.data_rg),
          r.produto ?? "",
          r.item_ov ?? "",
          r.tarefa_desc ?? "",
          r.operador ?? "",
          r.maquina_ativa ?? "",
          fmtBrDate(r.data_planejamento),
          fmtBrDate(r.data_conclusao),
          secToHms(r.tempoEstimadoSeg),
          secToHoraDia(r.horaConclusaoSeg),
        ].join(";"),
      )
      .join("\n");
    const blob = new Blob(["\uFEFF" + head + "\n" + body], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `controle-geral-rgs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <FiltersBar filters={filters} onChange={onFilters} rows={rows} />
      <div className="flex flex-wrap items-center gap-2">
        {QUICK.map((q) => (
          <button
            key={q.id}
            onClick={() => onFilters({ ...filters, situacao: q.id as DobraFilters["situacao"] })}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
              filters.situacao === q.id ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-secondary"
            }`}
          >
            {q.label}
          </button>
        ))}
        <input
          placeholder="Pesquisar..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className={inputCls + " w-52 ml-auto"}
        />
        <button
          onClick={exportCsv}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary"
        >
          <Download className="size-3.5" /> Exportar
        </button>
      </div>
      <Card title="Controle Geral de RGs">

        <DataTable
          rows={filtered}
          columns={cols}
          pageSize={25}
          rowClass={(r) => (r.atrasada ? "bg-destructive/10 text-destructive" : undefined)}
          footer={
            <span className="flex flex-wrap gap-x-4 gap-y-1">
              <span>RGs: <b>{resumo.total}</b></span>
              <span>Concluídas: <b className="text-[var(--success)]">{resumo.concluidas}</b></span>
              <span>Em produção: <b className="text-primary">{resumo.emProducao}</b></span>
              <span>Disponíveis: <b className="text-accent">{resumo.disponiveis}</b></span>
              <span>Aguardando: <b>{resumo.aguardando}</b></span>
              <span>Dobradas: <b className="text-[var(--success)]">{resumo.dobradas}</b></span>
              <span>Atrasadas: <b className="text-destructive">{resumo.atrasadas}</b></span>
              <span>FPPs: <b>{resumo.fpps}</b></span>
              <span>Horas estimadas: <b className="tabular-nums">{secToHms(resumo.seg)}</b></span>
            </span>
          }
        />
      </Card>
    </div>
  );
}
