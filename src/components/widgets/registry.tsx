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
} from "recharts";
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

const COLORS = [
  "oklch(0.72 0.15 215)",
  "oklch(0.78 0.16 75)",
  "oklch(0.7 0.16 155)",
  "oklch(0.7 0.18 45)",
  "oklch(0.65 0.22 305)",
];

export type WidgetModule = "Programação" | "Puncionadeira" | "Dobra" | "Geral";

export interface WidgetDef {
  id: string;
  title: string;
  module: WidgetModule;
  defaultW: number;
  defaultH: number;
  Component: (props: { config?: Record<string, unknown> }) => React.ReactElement;
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="h-full flex flex-col p-3 min-h-0">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 truncate">{title}</div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

function Stat({ value, hint, tone = "text-foreground" }: { value: string; hint?: string; tone?: string }) {
  return (
    <div className="h-full flex flex-col justify-center">
      <div className={`text-3xl font-bold leading-tight truncate ${tone}`}>{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1 truncate">{hint}</div>}
    </div>
  );
}

function Loading() {
  return <div className="h-full grid place-items-center text-xs text-muted-foreground">Carregando...</div>;
}

const axis = { fontSize: 11, fill: "hsl(var(--muted-foreground))" };

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
      return (
        <Shell title="Total solicitado">
          {isLoading ? <Loading /> : <Stat value={`${fmtInt(wasteTotalKg(data))} kg`} />}
        </Shell>
      );
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
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                <XAxis dataKey="label" tick={axis} />
                <YAxis tick={axis} width={38} />
                <Tooltip formatter={(v: number) => fmtPct(v)} />
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
                <Tooltip formatter={(v: number) => `${fmtInt(v)} kg`} />
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
      return (
        <Shell title="Peças programadas">{isLoading ? <Loading /> : <Stat value={fmtInt(data.length)} />}</Shell>
      );
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
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                <XAxis dataKey="label" tick={axis} />
                <YAxis tick={axis} width={40} />
                <Tooltip />
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
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                <XAxis dataKey="label" tick={axis} />
                <YAxis tick={axis} width={40} />
                <Tooltip />
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
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                <XAxis dataKey="label" tick={axis} />
                <YAxis tick={axis} width={38} domain={[0, 100]} />
                <Tooltip formatter={(v: number) => fmtPct(v, 1)} />
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
                <Tooltip formatter={(v: number) => `${fmtNum(v, 1)} h`} />
                <Bar dataKey="horas" fill={COLORS[3]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Shell>
      );
    },
  },
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
];

export const WIDGET_MAP = new Map(WIDGETS.map((w) => [w.id, w]));
