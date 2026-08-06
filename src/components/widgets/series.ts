import { useMemo } from "react";
import {
  useWaste,
  useProduction,
  useOeeDias,
  useOeeParadas,
  wasteByMonth,
  wasteByMaterial,
  prodByMachine,
  prodByDay,
  oeeByDay,
  paradasTop,
} from "@/lib/dashboardData";
import { buildRgCalc, useDobraFpps, useDobraRgs, useDobraSettings, fmtBrDate, capacidadeTotalSeg, todayISO, addDaysISO } from "@/lib/dobra";
import { controleRgPorMes, useDobraControleRg, useDobraPerformance } from "@/lib/dobraExtra";
import type { MetricModule } from "@/components/widgets/metrics";

export interface SeriesDef {
  id: string;
  label: string;
  module: MetricModule;
  /** chave do eixo X */
  xKey: string;
  /** séries numéricas disponíveis */
  keys: { key: string; label: string }[];
  data: Record<string, string | number>[];
}

/** Catálogo de séries disponíveis para montar gráficos personalizados. */
export function useSeriesCatalog(): { series: SeriesDef[]; loading: boolean } {
  const waste = useWaste();
  const prod = useProduction();
  const dias = useOeeDias();
  const paradas = useOeeParadas();
  const rgs = useDobraRgs();
  const fpps = useDobraFpps();
  const settings = useDobraSettings();
  const ctrl = useDobraControleRg();
  const perf = useDobraPerformance();

  const series = useMemo<SeriesDef[]>(() => {
    const dobra = buildRgCalc(rgs.data ?? [], fpps.data ?? [], settings.data?.tarefas ?? []);
    const abertas = dobra.filter((r) => r.situacao !== "concluida");
    const concluidas = dobra.filter((r) => r.situacao === "concluida");

    // produção diária da dobra
    const prodMap = new Map<string, { rgs: number; horas: number }>();
    for (const r of concluidas) {
      if (!r.data_conclusao) continue;
      const cur = prodMap.get(r.data_conclusao) ?? { rgs: 0, horas: 0 };
      cur.rgs += 1;
      cur.horas += (r.tempo_seg ?? r.tempoEstimadoSeg) / 3600;
      prodMap.set(r.data_conclusao, cur);
    }
    const dobraProducao = Array.from(prodMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-14)
      .map(([d, v]) => ({ label: fmtBrDate(d).slice(0, 5), rgs: v.rgs, horas: Number(v.horas.toFixed(1)) }));

    // carga x capacidade nos próximos 7 dias
    const capH = capacidadeTotalSeg(settings.data?.capacidade ?? ({} as never)) / 3600;
    const hoje = todayISO();
    const dobraCarga = Array.from({ length: 7 }, (_, i) => addDaysISO(hoje, i)).map((d) => {
      const list = abertas.filter((r) => r.data_planejamento === d);
      return {
        label: fmtBrDate(d).slice(0, 5),
        horas: Number((list.reduce((s, r) => s + r.tempoEstimadoSeg, 0) / 3600).toFixed(1)),
        capacidade: Number(capH.toFixed(1)),
      };
    });

    const statusDobra = [
      { label: "Em produção", valor: abertas.filter((r) => r.situacao === "em_producao").length },
      { label: "Disponíveis", valor: abertas.filter((r) => r.situacao === "disponivel").length },
      { label: "Aguardando", valor: abertas.filter((r) => r.situacao === "aguardando").length },
      { label: "Atrasadas", valor: abertas.filter((r) => r.atrasada).length },
    ];

    const perfTop = (perf.data ?? [])
      .filter((r) => (r.tempo_real_seg ?? 0) > 0)
      .slice(0, 12)
      .map((r) => ({
        label: r.fpp,
        performance: Number((r.performance ?? 0).toFixed(1)),
        horas: Number(((r.tempo_real_seg ?? 0) / 3600).toFixed(1)),
      }));

    return [
      {
        id: "waste.mensal",
        label: "Desperdício por mês",
        module: "Programação",
        xKey: "label",
        keys: [
          { key: "perda", label: "Perda (%)" },
          { key: "kg", label: "Kg" },
        ],
        data: wasteByMonth(waste.data ?? []),
      },
      {
        id: "waste.material",
        label: "Desperdício por material",
        module: "Programação",
        xKey: "name",
        keys: [{ key: "value", label: "Kg" }],
        data: wasteByMaterial(waste.data ?? []),
      },
      {
        id: "prod.maquina",
        label: "Produção por máquina",
        module: "Programação",
        xKey: "label",
        keys: [
          { key: "pecas", label: "Peças" },
          { key: "horas", label: "Horas" },
        ],
        data: prodByMachine(prod.data ?? []),
      },
      {
        id: "prod.dia",
        label: "Peças por dia",
        module: "Programação",
        xKey: "label",
        keys: [{ key: "pecas", label: "Peças" }],
        data: prodByDay(prod.data ?? []),
      },
      {
        id: "oee.diario",
        label: "OEE diário",
        module: "Puncionadeira",
        xKey: "label",
        keys: [{ key: "oee", label: "OEE (%)" }],
        data: oeeByDay(dias.data ?? []),
      },
      {
        id: "oee.paradas",
        label: "Maiores paradas",
        module: "Puncionadeira",
        xKey: "label",
        keys: [{ key: "horas", label: "Horas" }],
        data: paradasTop(paradas.data ?? []),
      },
      {
        id: "dobra.producao",
        label: "Produção da dobra por dia",
        module: "Dobra",
        xKey: "label",
        keys: [
          { key: "rgs", label: "RGs" },
          { key: "horas", label: "Horas" },
        ],
        data: dobraProducao,
      },
      {
        id: "dobra.carga",
        label: "Carga x capacidade (7 dias)",
        module: "Dobra",
        xKey: "label",
        keys: [
          { key: "horas", label: "Horas programadas" },
          { key: "capacidade", label: "Capacidade" },
        ],
        data: dobraCarga,
      },
      {
        id: "dobra.status",
        label: "Situação das RGs",
        module: "Dobra",
        xKey: "label",
        keys: [{ key: "valor", label: "RGs" }],
        data: statusDobra,
      },
      {
        id: "dobra.sla",
        label: "SLA e atravessamento por mês",
        module: "Dobra",
        xKey: "label",
        keys: [
          { key: "sla", label: "SLA (%)" },
          { key: "rgs", label: "RGs" },
          { key: "pecas", label: "Peças" },
          { key: "lead", label: "Atravessamento (dias)" },
        ],
        data: controleRgPorMes(ctrl.data ?? []),
      },
      {
        id: "dobra.performance",
        label: "Performance por FPP",
        module: "Dobra",
        xKey: "label",
        keys: [
          { key: "performance", label: "Performance (%)" },
          { key: "horas", label: "Horas reais" },
        ],
        data: perfTop,
      },
    ];
  }, [waste.data, prod.data, dias.data, paradas.data, rgs.data, fpps.data, settings.data, ctrl.data, perf.data]);

  return {
    series,
    loading: waste.isLoading || prod.isLoading || dias.isLoading || paradas.isLoading || rgs.isLoading,
  };
}
