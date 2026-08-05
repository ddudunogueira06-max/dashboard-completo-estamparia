import { useMemo } from "react";
import { DataTable, StatusBadge, type Column } from "./ui";
import { fmtBrDate, secToHms, sortEmAberto, type RgCalc } from "@/lib/dobra";

export function emAbertoColumns(): Column<RgCalc>[] {
  return [
    { key: "rg", header: "Nº RG", cell: (r) => <span className="font-medium text-primary">{r.rg}</span>, sortValue: (r) => r.rg },
    { key: "fpp", header: "FPP/FPG", cell: (r) => r.fpp ?? "—", sortValue: (r) => r.fpp ?? "" },
    { key: "produto", header: "Produto", cell: (r) => r.produto ?? "—", sortValue: (r) => r.produto ?? "" },
    {
      key: "tempo",
      header: "Tempo por RG",
      cell: (r) => <span className="tabular-nums">{secToHms(r.tempoEstimadoSeg)}</span>,
      sortValue: (r) => r.tempoEstimadoSeg,
    },
    { key: "qtd", header: "RGs (FPP)", cell: (r) => r.totalRgsFpp, sortValue: (r) => r.totalRgsFpp },
    { key: "rest", header: "Restantes", cell: (r) => r.rgsRestantesFpp, sortValue: (r) => r.rgsRestantesFpp },
    {
      key: "horas",
      header: "Horas restantes",
      cell: (r) => <span className="tabular-nums text-accent">{secToHms(r.horasRestantesFppSeg)}</span>,
      sortValue: (r) => r.horasRestantesFppSeg,
    },
    {
      key: "plan",
      header: "Data plan.",
      cell: (r) => <span className={r.atrasada ? "text-destructive font-medium" : ""}>{fmtBrDate(r.data_planejamento)}</span>,
      sortValue: (r) => r.data_planejamento ?? "",
    },
    { key: "tarefa", header: "Tarefa descrição", cell: (r) => r.tarefa_desc ?? "—", sortValue: (r) => r.tarefa_desc ?? "" },
    { key: "status", header: "Status", cell: (r) => <StatusBadge situacao={r.situacao} atrasada={r.atrasada} /> },
    { key: "op", header: "Operador", cell: (r) => r.operador ?? "—", sortValue: (r) => r.operador ?? "" },
    { key: "maq", header: "Máquina ativa", cell: (r) => r.maquina_ativa ?? "—", sortValue: (r) => r.maquina_ativa ?? "" },
  ];
}

export function EmAbertoTable({ rows, pageSize = 15 }: { rows: RgCalc[]; pageSize?: number }) {
  const sorted = useMemo(() => sortEmAberto(rows), [rows]);
  const totals = useMemo(() => {
    const emProd = rows.filter((r) => r.situacao === "em_producao").length;
    const disp = rows.filter((r) => r.situacao === "disponivel").length;
    const agu = rows.filter((r) => r.situacao === "aguardando").length;
    const fpps = new Set(rows.map((r) => r.fpp_key).filter(Boolean)).size;
    const horas = rows.reduce((s, r) => s + r.tempoEstimadoSeg, 0);
    return { emProd, disp, agu, fpps, horas };
  }, [rows]);

  return (
    <DataTable
      rows={sorted}
      columns={emAbertoColumns()}
      pageSize={pageSize}
      footer={
        <span className="flex flex-wrap gap-x-4 gap-y-1">
          <span>Em produção: <b className="text-primary">{totals.emProd}</b></span>
          <span>Disponíveis: <b className="text-accent">{totals.disp}</b></span>
          <span>Aguardando: <b>{totals.agu}</b></span>
          <span>FPPs: <b>{totals.fpps}</b></span>
          <span>Horas estimadas restantes: <b className="tabular-nums">{secToHms(totals.horas)}</b></span>
        </span>
      }
    />
  );
}
