import { useMemo } from "react";
import { DataTable, StatusBadge, type Column } from "./ui";
import { fmtBrDate, secToHms, SITUACAO_LABEL, type RgCalc } from "@/lib/dobra";

/**
 * RGs que já passaram pela dobra: concluídas, em logística interna ou em separação.
 */
export function DobradasTable({ rows, pageSize = 25 }: { rows: RgCalc[]; pageSize?: number }) {
  const cols: Column<RgCalc>[] = [
    { key: "status", header: "Status", cell: (r) => <StatusBadge situacao={r.situacao} /> },
    { key: "rg", header: "Nº RG", cell: (r) => <span className="font-medium text-[var(--success)]">{r.rg}</span>, sortValue: (r) => r.rg },
    { key: "fpp", header: "FPP/FPG", cell: (r) => r.fpp ?? "—", sortValue: (r) => r.fpp ?? "" },
    { key: "cliente", header: "Cliente", cell: (r) => <span className="max-w-[220px] truncate inline-block align-bottom">{r.cliente ?? "—"}</span>, sortValue: (r) => r.cliente ?? "" },
    { key: "ov", header: "Nr. OV", cell: (r) => r.nr_ov ?? "—", sortValue: (r) => r.nr_ov ?? "" },
    { key: "produto", header: "Produto", cell: (r) => r.produto ?? "—", sortValue: (r) => r.produto ?? "" },
    { key: "tarefa", header: "Tarefa descrição", cell: (r) => r.tarefa_desc ?? "—", sortValue: (r) => r.tarefa_desc ?? "" },
    { key: "plan", header: "Data plan.", cell: (r) => fmtBrDate(r.data_planejamento), sortValue: (r) => r.data_planejamento ?? "" },
    { key: "concl", header: "Conclusão", cell: (r) => fmtBrDate(r.data_conclusao), sortValue: (r) => r.data_conclusao ?? "" },
    { key: "op", header: "Operador", cell: (r) => r.operador ?? "—", sortValue: (r) => r.operador ?? "" },
    { key: "maq", header: "Máquina", cell: (r) => r.maquina_ativa ?? "—" },
    { key: "est", header: "Tempo estimado", cell: (r) => <span className="tabular-nums">{secToHms(r.tempoEstimadoSeg)}</span>, sortValue: (r) => r.tempoEstimadoSeg },
  ];

  const totals = useMemo(() => {
    const seg = rows.reduce((s, r) => s + r.tempoEstimadoSeg, 0);
    return {
      total: rows.length,
      concluidas: rows.filter((r) => r.situacao === "concluida").length,
      logistica: rows.filter((r) => r.situacao === "logistica").length,
      separacao: rows.filter((r) => r.situacao === "separacao").length,
      fpps: new Set(rows.map((r) => r.fpp_key).filter(Boolean)).size,
      seg,
    };
  }, [rows]);

  return (
    <DataTable
      rows={rows}
      columns={cols}
      pageSize={pageSize}
      empty="Nenhuma RG dobrada no período."
      footer={
        <span className="flex flex-wrap gap-x-4 gap-y-1">
          <span>RGs dobradas: <b>{totals.total}</b></span>
          <span>{SITUACAO_LABEL.concluida}s: <b className="text-[var(--success)]">{totals.concluidas}</b></span>
          <span>{SITUACAO_LABEL.logistica}: <b>{totals.logistica}</b></span>
          <span>{SITUACAO_LABEL.separacao}: <b>{totals.separacao}</b></span>
          <span>FPPs: <b>{totals.fpps}</b></span>
          <span>Horas estimadas: <b className="tabular-nums">{secToHms(totals.seg)}</b></span>
        </span>
      }
    />
  );
}
