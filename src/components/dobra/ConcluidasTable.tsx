import { useMemo } from "react";
import { DataTable, type Column } from "./ui";
import { fmtBrDate, secToHms, secToHoraDia, type RgCalc } from "@/lib/dobra";

export function ConcluidasTable({ rows, pageSize = 15 }: { rows: RgCalc[]; pageSize?: number }) {
  const cols: Column<RgCalc>[] = [
    { key: "rg", header: "Nº RG", cell: (r) => <span className="font-medium text-[var(--success)]">{r.rg}</span>, sortValue: (r) => r.rg },
    { key: "fpp", header: "FPP/FPG", cell: (r) => r.fpp ?? "—", sortValue: (r) => r.fpp ?? "" },
    { key: "cliente", header: "Cliente", cell: (r) => <span className="max-w-[220px] truncate inline-block align-bottom">{r.cliente ?? "—"}</span>, sortValue: (r) => r.cliente ?? "" },
    { key: "ov", header: "Nr. OV", cell: (r) => r.nr_ov ?? "—", sortValue: (r) => r.nr_ov ?? "" },
    { key: "produto", header: "Produto", cell: (r) => r.produto ?? "—", sortValue: (r) => r.produto ?? "" },
    { key: "item", header: "Item OV", cell: (r) => r.item_ov ?? "—" },
    { key: "plan", header: "Data plan.", cell: (r) => fmtBrDate(r.data_planejamento), sortValue: (r) => r.data_planejamento ?? "" },
    { key: "concl", header: "Conclusão", cell: (r) => fmtBrDate(r.data_conclusao), sortValue: (r) => r.data_conclusao ?? "" },
    {
      key: "hora",
      header: "Hora conclusão",
      cell: (r) => <span className="tabular-nums">{secToHoraDia(r.horaConclusaoSeg)}</span>,
      sortValue: (r) => r.horaConclusaoSeg ?? -1,
    },
    { key: "op", header: "Operador", cell: (r) => r.operador ?? "—", sortValue: (r) => r.operador ?? "" },
    { key: "maq", header: "Máquina", cell: (r) => r.maquina_ativa ?? "—" },
    { key: "est", header: "Tempo estimado", cell: (r) => <span className="tabular-nums">{secToHms(r.tempoEstimadoSeg)}</span>, sortValue: (r) => r.tempoEstimadoSeg },
    {
      key: "sla",
      header: "SLA",
      cell: (r) => {
        const ok = slaOk(r);
        if (ok === null) return "—";
        return (
          <span className={ok ? "text-[var(--success)] font-medium" : "text-destructive font-medium"}>
            {ok ? "No prazo" : "Fora"}
          </span>
        );
      },
    },
  ];

  const totals = useMemo(() => {
    const seg = rows.reduce((s, r) => s + r.tempoEstimadoSeg, 0);
    const avaliadas = rows.filter((r) => slaOk(r) !== null);
    const ok = avaliadas.filter((r) => slaOk(r) === true).length;
    const dias = new Set(rows.map((r) => r.data_dobra ?? r.data_conclusao).filter(Boolean)).size;
    return {
      total: rows.length,
      seg,
      media: rows.length ? seg / rows.length : 0,
      dias,
      porDia: dias ? rows.length / dias : 0,
      sla: avaliadas.length ? (ok / avaliadas.length) * 100 : 0,
    };
  }, [rows]);

  return (
    <DataTable
      rows={rows}
      columns={cols}
      pageSize={pageSize}
      footer={
        <span className="flex flex-wrap gap-x-4 gap-y-1">
          <span>RGs concluídas: <b>{totals.total}</b></span>
          <span>Horas estimadas: <b className="tabular-nums">{secToHms(totals.seg)}</b></span>
          <span>Média por RG: <b className="tabular-nums">{secToHms(totals.media)}</b></span>
          <span>Dias com produção: <b>{totals.dias}</b></span>
          <span>RGs/dia: <b className="tabular-nums">{totals.porDia.toFixed(1)}</b></span>
          <span>SLA: <b className="text-[var(--success)]">{totals.sla.toFixed(1)}%</b></span>
        </span>
      }
    />
  );
}


export function slaOk(r: RgCalc): boolean | null {
  if (!r.data_conclusao || !r.data_planejamento) return null;
  return r.data_conclusao <= r.data_planejamento;
}
