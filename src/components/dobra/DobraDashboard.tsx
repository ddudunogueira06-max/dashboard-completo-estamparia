import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle } from "lucide-react";
import { Card, Kpi } from "./ui";
import { EmAbertoTable } from "./EmAbertoTable";
import { ConcluidasTable, slaOk } from "./ConcluidasTable";
import { applyFilters, type DobraFilters } from "./filters";
import {
  addDaysISO,
  capacidadeTotalSeg,
  fmtBrDate,
  secToHms,
  todayISO,
  type Capacidade,
  type MetaParams,
  type RgCalc,
} from "@/lib/dobra";

export function DobraDashboard({
  rows,
  filters,
  capacidade,
  meta,
  onVerTodas,
}: {
  rows: RgCalc[];
  filters: DobraFilters;
  capacidade: Capacidade;
  meta: MetaParams;
  onVerTodas: (tab: string) => void;
}) {
  const [serie, setSerie] = useState<"rgs" | "pecas" | "horas">("rgs");

  const abertas = useMemo(() => applyFilters(rows, filters).filter((r) => r.situacao !== "concluida"), [rows, filters]);
  const concluidas = useMemo(
    () => applyFilters(rows.filter((r) => r.situacao === "concluida"), filters, "data_conclusao"),
    [rows, filters],
  );

  const kpis = useMemo(() => {
    const avaliadas = concluidas.filter((r) => slaOk(r) !== null);
    const sla = avaliadas.length ? (avaliadas.filter((r) => slaOk(r) === true).length / avaliadas.length) * 100 : 0;
    const horas = concluidas.reduce((s, r) => s + (r.tempo_seg ?? r.tempoEstimadoSeg), 0);
    const dias = new Set(concluidas.map((r) => r.data_conclusao).filter(Boolean)).size || 1;
    return {
      sla,
      rgs: concluidas.length,
      horas,
      media: concluidas.length / dias,
      pendentes: abertas.filter((r) => r.situacao === "aguardando" || r.situacao === "disponivel").length,
      emProducao: abertas.filter((r) => r.situacao === "em_producao").length,
      disponiveis: abertas.filter((r) => r.situacao === "disponivel").length,
      aguardando: abertas.filter((r) => r.situacao === "aguardando").length,
      atrasadas: abertas.filter((r) => r.atrasada).length,
    };
  }, [concluidas, abertas]);

  /* Produção por período — últimos 14 dias com conclusão */
  const producao = useMemo(() => {
    const map = new Map<string, { rgs: number; horas: number }>();
    for (const r of concluidas) {
      if (!r.data_conclusao) continue;
      const cur = map.get(r.data_conclusao) ?? { rgs: 0, horas: 0 };
      cur.rgs += 1;
      cur.horas += (r.tempo_seg ?? r.tempoEstimadoSeg) / 3600;
      map.set(r.data_conclusao, cur);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-14)
      .map(([d, v]) => ({ label: fmtBrDate(d).slice(0, 5), rgs: v.rgs, horas: Number(v.horas.toFixed(1)), pecas: v.rgs }));
  }, [concluidas]);

  /* Carga de dobra por dia — próximos 7 dias */
  const capSeg = capacidadeTotalSeg(capacidade);
  const carga = useMemo(() => {
    const hoje = todayISO();
    return Array.from({ length: 7 }, (_, i) => addDaysISO(hoje, i)).map((d) => {
      const list = abertas.filter((r) => (r.data_planejamento ?? "") <= d && (i(d) ? true : true) && r.data_planejamento === d);
      const horas = list.reduce((s, r) => s + r.tempoEstimadoSeg, 0) / 3600;
      const capH = capSeg / 3600;
      return {
        label: fmtBrDate(d).slice(0, 5),
        horas: Number(horas.toFixed(1)),
        capacidade: Number(capH.toFixed(1)),
        util: capH ? Number(((horas / capH) * 100).toFixed(1)) : 0,
        rgs: list.length,
        fpps: new Set(list.map((r) => r.fpp_key)).size,
      };
    });
    function i(_d: string) {
      return true;
    }
  }, [abertas, capSeg]);

  const alertas = useMemo(
    () =>
      [
        { label: "RGs atrasadas", n: kpis.atrasadas, detail: "Data de planejamento vencida" },
        { label: "RGs sem FPP/FPG", n: abertas.filter((r) => !r.fpp_key).length, detail: "Sem vínculo com pacote" },
        { label: "RGs sem tempo estimado", n: abertas.filter((r) => !r.tempoEstimadoSeg).length, detail: "FPP sem tempo" },
        { label: "RGs sem tarefa descrição", n: abertas.filter((r) => !r.tarefa_desc).length, detail: "Aguardando etapa anterior" },
        { label: "RGs sem data de planejamento", n: abertas.filter((r) => !r.data_planejamento).length, detail: "Sem prazo definido" },
        {
          label: "Carga acima da capacidade",
          n: carga.filter((c) => c.util > 100).length,
          detail: "Dias com sobrecarga nos próximos 7 dias",
        },
      ].filter((a) => a.n > 0),
    [kpis.atrasadas, abertas, carga],
  );

  const barColor = (u: number) => (u > 100 ? "var(--destructive)" : u >= 85 ? "var(--warning)" : "var(--chart-1)");

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-6">
        <Kpi label="Entrega SLA" value={`${kpis.sla.toFixed(1)}%`} sub={`Meta: ${meta.metaSla}%`} tone={kpis.sla >= meta.metaSla ? "success" : "destructive"} />
        <Kpi label="RGs produzidas" value={kpis.rgs} sub="No período" tone="primary" onClick={() => onVerTodas("concluidas")} />
        <Kpi label="Peças produzidas" value={kpis.rgs} sub="RGs concluídas" />
        <Kpi label="Horas produzidas" value={secToHms(kpis.horas)} sub="Tempo real/estimado" tone="primary" />
        <Kpi
          label="Média de RGs/dia"
          value={kpis.media.toFixed(1)}
          sub={`Meta ${meta.metaRgsDia} · ${meta.metaRgsDia ? ((kpis.media / meta.metaRgsDia) * 100).toFixed(0) : 0}%`}
        />
        <Kpi
          label="Status geral"
          value={`${kpis.atrasadas} atrasadas`}
          sub={`${kpis.emProducao} em produção · ${kpis.disponiveis} disponíveis · ${kpis.aguardando} aguardando`}
          tone="accent"
          onClick={() => onVerTodas("aberto")}
        />
      </div>

      <Card
        title={`Dobra — Em aberto por RG (${abertas.length})`}
        right={
          <button onClick={() => onVerTodas("aberto")} className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-secondary">
            Ver todas
          </button>
        }
      >
        <EmAbertoTable rows={abertas} pageSize={8} />
      </Card>

      <Card
        title={`RGs concluídas (${concluidas.length})`}
        right={
          <button onClick={() => onVerTodas("concluidas")} className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-secondary">
            Ver todas
          </button>
        }
      >
        <ConcluidasTable rows={concluidas} pageSize={8} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Produção por período"
          right={
            <div className="flex gap-1">
              {(["rgs", "pecas", "horas"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSerie(s)}
                  className={`rounded-md px-2.5 py-1 text-xs ${serie === s ? "bg-primary text-primary-foreground" : "border border-border hover:bg-secondary"}`}
                >
                  {s === "rgs" ? "RGs" : s === "pecas" ? "Peças" : "Horas"}
                </button>
              ))}
            </div>
          }
        >
          <div className="h-64 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={producao}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)" }} />
                <Bar dataKey={serie} fill="var(--chart-1)" radius={[4, 4, 0, 0]} name={serie === "horas" ? "Horas" : serie === "pecas" ? "Peças" : "RGs"} />
                {serie === "rgs" && <ReferenceLine y={meta.metaRgsDia} stroke="var(--destructive)" strokeDasharray="4 4" />}
                <Line type="monotone" dataKey="rgs" stroke="var(--chart-2)" dot={false} name="RGs" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Carga de dobra por dia (próximos 7 dias)">
          <div className="h-64 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={carga}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <Tooltip
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)" }}
                  formatter={(v: number, n: string) => [n === "util" ? `${v}%` : `${v}h`, n === "horas" ? "Horas programadas" : n === "capacidade" ? "Capacidade" : "Utilização"]}
                />
                <ReferenceLine y={capSeg / 3600} stroke="var(--destructive)" strokeDasharray="4 4" />
                <Bar dataKey="horas" radius={[4, 4, 0, 0]}>
                  {carga.map((c, i) => (
                    <Cell key={i} fill={barColor(c.util)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {alertas.length > 0 && (
        <Card title="Alertas importantes">
          <div className="divide-y divide-border">
            {alertas.map((a) => (
              <div key={a.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <AlertTriangle className="size-4 shrink-0 text-accent" />
                  <span className="truncate">{a.label}</span>
                  <span className="truncate text-xs text-muted-foreground hidden sm:inline">— {a.detail}</span>
                </div>
                <span className="shrink-0 rounded-md bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent tabular-nums">{a.n}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
