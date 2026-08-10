import { useMemo } from "react";
import {
  useWaste,
  useProduction,
  useOeeDias,
  useOeeParadas,
  wasteWeightedLoss,
  wasteTotalKg,
  oeeAverage,
  paradasTop,
  prodByMachine,
} from "@/lib/dashboardData";
import { fmtInt, fmtNum, fmtPct } from "@/lib/format";
import { buildRgCalc, secToHms, useDobraFpps, useDobraRgs, useDobraSettings } from "@/lib/dobra";
import { resumoControleRg, resumoPerformance, useDobraControleRg, useDobraPerformance } from "@/lib/dobraExtra";

export type MetricModule = "Programação" | "Puncionadeira" | "Dobra";

export interface TickerMetric {
  id: string;
  label: string;
  value: string;
  hint?: string;
  module: MetricModule;
}

export function useTickerMetrics(): { metrics: TickerMetric[]; loading: boolean } {
  const waste = useWaste();
  const prod = useProduction();
  const dias = useOeeDias();
  const paradas = useOeeParadas();
  const rgs = useDobraRgs();
  const fpps = useDobraFpps();
  const settings = useDobraSettings();
  const perf = useDobraPerformance();
  const ctrl = useDobraControleRg();

  const w = waste.data ?? [];
  const p = prod.data ?? [];
  const d = dias.data ?? [];
  const pr = paradas.data ?? [];

  const dobra = useMemo(
    () => buildRgCalc(rgs.data ?? [], fpps.data ?? [], settings.data?.tarefas ?? [], settings.data?.ajuste),
    [rgs.data, fpps.data, settings.data],
  );

  const metrics = useMemo(() => {
    const machines = prodByMachine(p);
    const topMachine = machines.slice().sort((a, b) => b.pecas - a.pecas)[0];
    const topParada = paradasTop(pr, 1)[0];
    const totalSeg = p.reduce((s, r) => s + (r.tempo_execucao_seg ?? 0), 0);

    const abertas = dobra.filter((r) => r.situacao !== "concluida");
    const concl = dobra.filter((r) => r.situacao === "concluida");
    const horasAbertas = abertas.reduce((s, r) => s + r.tempoEstimadoSeg, 0);
    const rp = resumoPerformance(perf.data ?? []);
    const rc = resumoControleRg(ctrl.data ?? []);

    const list: TickerMetric[] = [
      { id: "perda_media", label: "Perda média ponderada", value: fmtPct(wasteWeightedLoss(w)), module: "Programação" },
      { id: "total_kg", label: "Total solicitado", value: `${fmtInt(wasteTotalKg(w))} kg`, module: "Programação" },
      { id: "registros_desp", label: "Registros de desperdício", value: fmtInt(w.length), module: "Programação" },
      { id: "pecas", label: "Peças programadas", value: fmtInt(p.length), module: "Programação" },
      { id: "horas_exec", label: "Horas de execução", value: `${fmtNum(totalSeg / 3600, 1)} h`, module: "Programação" },
      {
        id: "maquina_top",
        label: "Máquina com mais peças",
        value: topMachine ? topMachine.label : "—",
        hint: topMachine ? `${fmtInt(topMachine.pecas)} peças` : undefined,
        module: "Programação",
      },
      { id: "oee_medio", label: "OEE médio", value: fmtPct(oeeAverage(d), 1), module: "Puncionadeira" },
      { id: "oee_dias", label: "Dias de OEE registrados", value: fmtInt(d.length), module: "Puncionadeira" },
      {
        id: "parada_top",
        label: "Maior parada",
        value: topParada ? topParada.label : "—",
        hint: topParada ? `${fmtNum(topParada.horas, 1)} h` : undefined,
        module: "Puncionadeira",
      },
      { id: "dobra_abertas", label: "RGs em aberto", value: fmtInt(abertas.length), module: "Dobra" },
      { id: "dobra_atrasadas", label: "RGs atrasadas", value: fmtInt(abertas.filter((r) => r.atrasada).length), module: "Dobra" },
      { id: "dobra_producao", label: "RGs em produção", value: fmtInt(abertas.filter((r) => r.situacao === "em_producao").length), module: "Dobra" },
      { id: "dobra_disponiveis", label: "RGs disponíveis para dobrar", value: fmtInt(abertas.filter((r) => r.situacao === "disponivel").length), module: "Dobra" },
      { id: "dobra_concluidas", label: "RGs concluídas", value: fmtInt(concl.length), module: "Dobra" },
      { id: "dobra_horas_abertas", label: "Horas a produzir", value: secToHms(horasAbertas), module: "Dobra" },
      { id: "dobra_sla", label: "SLA da dobra", value: fmtPct(rc.slaPct, 1), hint: `${fmtInt(rc.concluidos)} RGs avaliadas`, module: "Dobra" },
      { id: "dobra_lead", label: "Atravessamento médio", value: `${fmtNum(rc.leadMedioDias, 1)} dias`, module: "Dobra" },
      { id: "dobra_perf", label: "Performance das FPPs", value: fmtPct(rp.performance, 1), hint: `${fmtInt(rp.fpps)} FPPs`, module: "Dobra" },
      { id: "dobra_pecas", label: "Peças dobradas", value: fmtInt(rc.pecas), module: "Dobra" },
    ];
    return list;
  }, [w, p, d, pr, dobra, perf.data, ctrl.data]);

  return {
    metrics,
    loading:
      waste.isLoading || prod.isLoading || dias.isLoading || paradas.isLoading || rgs.isLoading || fpps.isLoading,
  };
}
