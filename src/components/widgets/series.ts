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
import { buildCargaDiaria, buildProducaoDiaria, buildRgCalc, useDobraFpps, useDobraRgs, useDobraSettings, fmtBrDate, capacidadeTotalSeg, todayISO, addDaysISO } from "@/lib/dobra";
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
  data: Record<string, unknown>[];
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
    const dobra = buildRgCalc(rgs.data ?? [], fpps.data ?? [], settings.data?.tarefas ?? [], settings.data?.ajuste);
    const abertas = dobra.filter((r) => r.situacao !== "concluida");
    const concluidas = dobra.filter((r) => r.situacao === "concluida");

    // peças reais por RG (BD-CONTROLE-RG)
    const pecasPorRg = new Map<string, number>();
    for (const c of ctrl.data ?? []) {
      if (c.rg_key) pecasPorRg.set(c.rg_key, (pecasPorRg.get(c.rg_key) ?? 0) + (c.quantidade ?? 0));
    }

    const dobraProducao = buildProducaoDiaria(concluidas, pecasPorRg);

    const capH = capacidadeTotalSeg(settings.data?.capacidade ?? ({} as never));
    const dobraCarga = buildCargaDiaria(abertas, capH);

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
          { key: "pecas", label: "Peças" },
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
