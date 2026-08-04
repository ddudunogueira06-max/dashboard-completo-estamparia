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

export interface TickerMetric {
  id: string;
  label: string;
  value: string;
  hint?: string;
  module: "Programação" | "Puncionadeira" | "Dobra";
}

export function useTickerMetrics(): { metrics: TickerMetric[]; loading: boolean } {
  const waste = useWaste();
  const prod = useProduction();
  const dias = useOeeDias();
  const paradas = useOeeParadas();

  const w = waste.data ?? [];
  const p = prod.data ?? [];
  const d = dias.data ?? [];
  const pr = paradas.data ?? [];

  const machines = prodByMachine(p);
  const topMachine = machines.slice().sort((a, b) => b.pecas - a.pecas)[0];
  const topParada = paradasTop(pr, 1)[0];
  const totalSeg = p.reduce((s, r) => s + (r.tempo_execucao_seg ?? 0), 0);

  const metrics: TickerMetric[] = [
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
  ];

  return {
    metrics,
    loading: waste.isLoading || prod.isLoading || dias.isLoading || paradas.isLoading,
  };
}
