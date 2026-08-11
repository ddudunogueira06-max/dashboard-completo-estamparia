import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  Legend,
} from "recharts";
import { useMemo } from "react";
import {
  useWaste,
  useProduction,
  useOeeDias,
  useOeeParadas,
  wasteWeightedLoss,
  wasteTotalKg,
  wasteByMonth,
  wasteByMaterial,
  prodByMachine,
  prodByDay,
  oeeAverage,
  oeeByDay,
  paradasTop,
} from "@/lib/dashboardData";
import { fmtInt, fmtNum, fmtPct } from "@/lib/format";
import { TickerPanel } from "@/components/TickerPanel";
import { buildRgCalc, secToHms, useDobraFpps, useDobraRgs, useDobraSettings } from "@/lib/dobra";
import { resumoControleRg, resumoPerformance, useDobraControleRg, useDobraPerformance } from "@/lib/dobraExtra";
import { useSeriesCatalog } from "@/components/widgets/series";
import { useTickerMetrics } from "@/components/widgets/metrics";
import type { CustomWidget } from "@/components/widgets/customWidgets";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export type WidgetModule = "Programação" | "Puncionadeira" | "Dobra" | "Geral";

export const MODULE_ACCENT: Record<WidgetModule, string> = {
  "Programação": "var(--mod-programacao)",
  Puncionadeira: "var(--mod-puncionadeira)",
  Dobra: "var(--mod-dobra)",
  Geral: "var(--mod-geral)",
};

export interface WidgetDef {
  id: string;
  title: string;
  module: WidgetModule;
  defaultW: number;
  defaultH: number;
  Component: (props: { config?: Record<string, unknown> }) => React.ReactElement;
}

export function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="h-full flex flex-col p-3 min-h-0">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 truncate">{title}</div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

function Stat({ value, hint, tone = "text-foreground" }: { value: string; hint?: string; tone?: string }) {
  const long = value.length > 9;
  return (
    <div className="h-full flex flex-col justify-center gap-1">
      <div className={`font-bold leading-none tabular-nums break-words ${long ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl"} ${tone}`}>
        {value}
      </div>
      {hint && <div className="text-[11px] leading-snug text-muted-foreground line-clamp-2">{hint}</div>}
    </div>
  );
}

function Loading() {
  return <div className="h-full grid place-items-center text-xs text-muted-foreground">Carregando...</div>;
}

const axis = { fontSize: 11, fill: "var(--muted-foreground)" };
const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--popover-foreground)",
  fontSize: 12,
};

/** Tooltip legível em ambos os temas (o texto herdava a cor da barra). */
const tip = {
  contentStyle: tooltipStyle,
  labelStyle: { color: "var(--popover-foreground)", fontWeight: 600 },
  itemStyle: { color: "var(--popover-foreground)" },
  cursor: { fill: "color-mix(in oklab, var(--foreground) 8%, transparent)" },
} as const;

function useDobraCalc() {
  const { data: rgs = [], isLoading: l1 } = useDobraRgs();
  const { data: fpps = [], isLoading: l2 } = useDobraFpps();
  const { data: settings } = useDobraSettings();
  const rows = useMemo(() => buildRgCalc(rgs, fpps, settings?.tarefas ?? [], settings?.ajuste), [rgs, fpps, settings]);
  return { rows, isLoading: l1 || l2 };
}

export const WIDGETS: WidgetDef[] = [
  {
    id: "waste.kpi.perda",
    title: "Perda média ponderada",
    module: "Programação",
    defaultW: 3,
    defaultH: 2,
    Component: () => {
      const { data = [], isLoading } = useWaste();
      return (
        <Shell title="Perda média ponderada">
          {isLoading ? <Loading /> : <Stat value={fmtPct(wasteWeightedLoss(data))} hint={`${fmtInt(data.length)} registros`} tone="text-primary" />}
        </Shell>
      );
    },
  },
  {
    id: "waste.kpi.kg",
    title: "Total solicitado (kg)",
    module: "Programação",
    defaultW: 3,
    defaultH: 2,
    Component: () => {
      const { data = [], isLoading } = useWaste();
      return <Shell title="Total solicitado">{isLoading ? <Loading /> : <Stat value={`${fmtInt(wasteTotalKg(data))} kg`} />}</Shell>;
    },
  },
  {
    id: "waste.chart.mensal",
    title: "Perda por mês (%)",
    module: "Programação",
    defaultW: 6,
    defaultH: 4,
    Component: () => {
      const { data = [], isLoading } = useWaste();
      const series = wasteByMonth(data);
      return (
        <Shell title="Perda por mês (%)">
          {isLoading ? (
            <Loading />
          ) : (
            <ResponsiveContainer>
              <BarChart data={series} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={axis} />
                <YAxis tick={axis} width={38} />
                <Tooltip {...tip} formatter={(v: number) => fmtPct(v)} />
                <Bar dataKey="perda" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Shell>
      );
    },
  },
  {
    id: "waste.chart.material",
    title: "Distribuição por material (kg)",
    module: "Programação",
    defaultW: 4,
    defaultH: 4,
    Component: () => {
      const { data = [], isLoading } = useWaste();
      const series = wasteByMaterial(data);
      return (
        <Shell title="Material (kg)">
          {isLoading ? (
            <Loading />
          ) : (
            <ResponsiveContainer>
              <PieChart>
                <Pie data={series} dataKey="value" nameKey="name" innerRadius="45%" outerRadius="75%">
                  {series.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip {...tip} formatter={(v: number) => `${fmtInt(v)} kg`} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Shell>
      );
    },
  },
  {
    id: "prod.kpi.pecas",
    title: "Peças programadas",
    module: "Programação",
    defaultW: 3,
    defaultH: 2,
    Component: () => {
      const { data = [], isLoading } = useProduction();
      return <Shell title="Peças programadas">{isLoading ? <Loading /> : <Stat value={fmtInt(data.length)} />}</Shell>;
    },
  },
  {
    id: "prod.kpi.horas",
    title: "Horas de execução",
    module: "Programação",
    defaultW: 3,
    defaultH: 2,
    Component: () => {
      const { data = [], isLoading } = useProduction();
      const seg = data.reduce((s, r) => s + (r.tempo_execucao_seg ?? 0), 0);
      return <Shell title="Horas de execução">{isLoading ? <Loading /> : <Stat value={`${fmtNum(seg / 3600, 1)} h`} />}</Shell>;
    },
  },
  {
    id: "prod.chart.maquina",
    title: "Produção por máquina",
    module: "Programação",
    defaultW: 5,
    defaultH: 4,
    Component: () => {
      const { data = [], isLoading } = useProduction();
      const series = prodByMachine(data);
      return (
        <Shell title="Produção por máquina">
          {isLoading ? (
            <Loading />
          ) : (
            <ResponsiveContainer>
              <BarChart data={series} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={axis} />
                <YAxis tick={axis} width={40} />
                <Tooltip {...tip} />
                <Bar dataKey="pecas" name="Peças" fill={COLORS[2]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Shell>
      );
    },
  },
  {
    id: "prod.chart.dia",
    title: "Peças por dia",
    module: "Programação",
    defaultW: 6,
    defaultH: 4,
    Component: () => {
      const { data = [], isLoading } = useProduction();
      const series = prodByDay(data);
      return (
        <Shell title="Peças por dia (últimos 14)">
          {isLoading ? (
            <Loading />
          ) : (
            <ResponsiveContainer>
              <LineChart data={series} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={axis} />
                <YAxis tick={axis} width={40} />
                <Tooltip {...tip} />
                <Line type="monotone" dataKey="pecas" stroke={COLORS[0]} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Shell>
      );
    },
  },
  {
    id: "oee.kpi.medio",
    title: "OEE médio",
    module: "Puncionadeira",
    defaultW: 3,
    defaultH: 2,
    Component: () => {
      const { data = [], isLoading } = useOeeDias();
      return (
        <Shell title="OEE médio">
          {isLoading ? <Loading /> : <Stat value={fmtPct(oeeAverage(data), 1)} tone="text-primary" hint={`${fmtInt(data.length)} dias`} />}
        </Shell>
      );
    },
  },
  {
    id: "oee.chart.diario",
    title: "OEE diário",
    module: "Puncionadeira",
    defaultW: 6,
    defaultH: 4,
    Component: () => {
      const { data = [], isLoading } = useOeeDias();
      const series = oeeByDay(data);
      return (
        <Shell title="OEE diário (%)">
          {isLoading ? (
            <Loading />
          ) : (
            <ResponsiveContainer>
              <LineChart data={series} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={axis} />
                <YAxis tick={axis} width={38} domain={[0, 100]} />
                <Tooltip {...tip} formatter={(v: number) => fmtPct(v, 1)} />
                <Line type="monotone" dataKey="oee" stroke={COLORS[1]} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Shell>
      );
    },
  },
  {
    id: "oee.chart.paradas",
    title: "Maiores paradas (h)",
    module: "Puncionadeira",
    defaultW: 5,
    defaultH: 4,
    Component: () => {
      const { data = [], isLoading } = useOeeParadas();
      const series = paradasTop(data);
      return (
        <Shell title="Maiores paradas (h)">
          {isLoading ? (
            <Loading />
          ) : (
            <ResponsiveContainer>
              <BarChart data={series} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                <XAxis type="number" tick={axis} />
                <YAxis type="category" dataKey="label" tick={{ ...axis, fontSize: 10 }} width={110} />
                <Tooltip {...tip} formatter={(v: number) => `${fmtNum(v, 1)} h`} />
                <Bar dataKey="horas" fill={COLORS[3]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Shell>
      );
    },
  },

  /* ---------------------- Dobra ---------------------- */
  {
    id: "dobra.kpi.sla",
    title: "SLA da dobra",
    module: "Dobra",
    defaultW: 3,
    defaultH: 2,
    Component: () => {
      const { data = [], isLoading } = useDobraControleRg();
      const r = resumoControleRg(data);
      return (
        <Shell title="SLA da dobra">
          {isLoading ? <Loading /> : <Stat value={fmtPct(r.slaPct, 1)} hint={`${fmtInt(r.concluidos)} RGs concluídas`} tone="text-[var(--success)]" />}
        </Shell>
      );
    },
  },
  {
    id: "dobra.kpi.abertas",
    title: "RGs em aberto",
    module: "Dobra",
    defaultW: 3,
    defaultH: 2,
    Component: () => {
      const { rows, isLoading } = useDobraCalc();
      const abertas = rows.filter((r) => r.situacao !== "concluida");
      return (
        <Shell title="RGs em aberto">
          {isLoading ? (
            <Loading />
          ) : (
            <Stat
              value={fmtInt(abertas.length)}
              hint={`${abertas.filter((r) => r.atrasada).length} atrasadas`}
              tone="text-primary"
            />
          )}
        </Shell>
      );
    },
  },
  {
    id: "dobra.kpi.horas",
    title: "Horas a produzir",
    module: "Dobra",
    defaultW: 3,
    defaultH: 2,
    Component: () => {
      const { rows, isLoading } = useDobraCalc();
      const seg = rows.filter((r) => r.situacao !== "concluida").reduce((s, r) => s + r.tempoEstimadoSeg, 0);
      return <Shell title="Horas a produzir">{isLoading ? <Loading /> : <Stat value={secToHms(seg)} tone="text-accent" />}</Shell>;
    },
  },
  {
    id: "dobra.kpi.performance",
    title: "Performance das FPPs",
    module: "Dobra",
    defaultW: 3,
    defaultH: 2,
    Component: () => {
      const { data = [], isLoading } = useDobraPerformance();
      const r = resumoPerformance(data);
      return (
        <Shell title="Performance das FPPs">
          {isLoading ? <Loading /> : <Stat value={fmtPct(r.performance, 1)} hint={`${fmtInt(r.fpps)} FPPs · ${fmtInt(r.pecas)} peças`} />}
        </Shell>
      );
    },
  },
  {
    id: "dobra.chart.status",
    title: "Situação das RGs",
    module: "Dobra",
    defaultW: 4,
    defaultH: 4,
    Component: () => {
      const { rows, isLoading } = useDobraCalc();
      const abertas = rows.filter((r) => r.situacao !== "concluida");
      const series = [
        { name: "Em produção", value: abertas.filter((r) => r.situacao === "em_producao").length },
        { name: "Disponíveis", value: abertas.filter((r) => r.situacao === "disponivel").length },
        { name: "Aguardando", value: abertas.filter((r) => r.situacao === "aguardando").length },
      ].filter((d) => d.value > 0);
      return (
        <Shell title="Situação das RGs">
          {isLoading ? (
            <Loading />
          ) : (
            <ResponsiveContainer>
              <PieChart>
                <Pie data={series} dataKey="value" nameKey="name" innerRadius="45%" outerRadius="75%">
                  {series.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip {...tip} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Shell>
      );
    },
  },
  {
    id: "dobra.chart.producao",
    title: "Produção da dobra por dia",
    module: "Dobra",
    defaultW: 6,
    defaultH: 4,
    Component: () => <SeriesChart seriesId="dobra.producao" keys={["rgs"]} kind="bar" title="Produção da dobra por dia" />,
  },
  {
    id: "dobra.chart.carga",
    title: "Carga x capacidade (7 dias)",
    module: "Dobra",
    defaultW: 6,
    defaultH: 4,
    Component: () => (
      <SeriesChart seriesId="dobra.carga" keys={["horas", "capacidade"]} kind="bar" title="Carga x capacidade (7 dias)" />
    ),
  },
  {
    id: "dobra.chart.sla",
    title: "SLA por mês",
    module: "Dobra",
    defaultW: 6,
    defaultH: 4,
    Component: () => <SeriesChart seriesId="dobra.sla" keys={["sla"]} kind="line" title="SLA por mês (%)" />,
  },
  {
    id: "dobra.chart.performance",
    title: "Performance por FPP",
    module: "Dobra",
    defaultW: 6,
    defaultH: 4,
    Component: () => <SeriesChart seriesId="dobra.performance" keys={["performance"]} kind="bar" title="Performance por FPP (%)" />,
  },

  /* ---------------------- Geral ---------------------- */
  {
    id: "geral.ticker",
    title: "Painel rotativo",
    module: "Geral",
    defaultW: 4,
    defaultH: 3,
    Component: ({ config }) => (
      <TickerPanel
        selected={(config?.["metrics"] as string[]) ?? []}
        intervalMs={(config?.["intervalMs"] as number) ?? 6000}
      />
    ),
  },
  {
    id: "geral.letreiro",
    title: "Letreiro contínuo",
    module: "Geral",
    defaultW: 12,
    defaultH: 1,
    Component: ({ config }) => (
      <TickerPanel selected={(config?.["metrics"] as string[]) ?? []} mode="marquee" speed={60} />
    ),
  },
];

export const WIDGET_MAP = new Map(WIDGETS.map((w) => [w.id, w]));

/* ------------------------------------------------------------------ */
/* Renderização de gráficos a partir do catálogo de séries             */
/* ------------------------------------------------------------------ */

export function SeriesChart({
  seriesId,
  keys,
  kind,
  title,
}: {
  seriesId: string;
  keys: string[];
  kind: "bar" | "line" | "area" | "pie";
  title: string;
}) {
  const { series, loading } = useSeriesCatalog();
  const def = series.find((s) => s.id === seriesId);

  if (loading) return <Shell title={title}><Loading /></Shell>;
  if (!def) return <Shell title={title}><div className="text-xs text-muted-foreground">Fonte de dados indisponível.</div></Shell>;
  const use = keys.length ? keys : [def.keys[0]?.key].filter(Boolean) as string[];

  if (def.data.length === 0)
    return (
      <Shell title={title}>
        <div className="h-full grid place-items-center text-xs text-muted-foreground text-center px-3">
          Sem dados importados para esta fonte.
        </div>
      </Shell>
    );

  return (
    <Shell title={title}>
      <ResponsiveContainer>
        {kind === "pie" ? (
          <PieChart>
            <Pie data={def.data} dataKey={use[0]} nameKey={def.xKey} innerRadius="45%" outerRadius="75%">
              {def.data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Tooltip {...tip} />
          </PieChart>
        ) : kind === "line" ? (
          <LineChart data={def.data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey={def.xKey} tick={axis} />
            <YAxis tick={axis} width={40} />
            <Tooltip {...tip} />
            {use.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
            {use.map((k, i) => (
              <Line key={k} type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
            ))}
          </LineChart>
        ) : kind === "area" ? (
          <AreaChart data={def.data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey={def.xKey} tick={axis} />
            <YAxis tick={axis} width={40} />
            <Tooltip {...tip} />
            {use.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
            {use.map((k, i) => (
              <Area key={k} type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.25} />
            ))}
          </AreaChart>
        ) : (
          <BarChart data={def.data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey={def.xKey} tick={axis} />
            <YAxis tick={axis} width={40} />
            <Tooltip {...tip} />
            {use.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
            {use.map((k, i) => (
              <Bar key={k} dataKey={k} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </Shell>
  );
}

/** Renderiza um widget criado pelo usuário no editor. */
export function CustomWidgetView({ def, tickerMetrics }: { def: CustomWidget; tickerMetrics: string[] }) {
  const { metrics } = useTickerMetrics();

  if (def.kind === "texto") {
    return (
      <div className="h-full w-full grid place-items-center px-4 text-center">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{def.module}</div>
          <div className="text-2xl font-bold text-foreground break-words">{def.text || def.title}</div>
        </div>
      </div>
    );
  }

  if (def.kind === "kpi") {
    const m = metrics.find((x) => x.id === def.source);
    return (
      <Shell title={def.title}>
        {m ? <Stat value={m.value} hint={m.hint ?? m.label} tone="text-primary" /> : <div className="text-xs text-muted-foreground">Métrica não encontrada.</div>}
      </Shell>
    );
  }

  void tickerMetrics;
  return <SeriesChart seriesId={def.source ?? ""} keys={def.keys ?? []} kind={def.kind} title={def.title} />;
}
