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
import { AlertTriangle, X } from "lucide-react";
import { Card, Kpi } from "./ui";
import { EmAbertoTable } from "./EmAbertoTable";
import { ConcluidasTable, slaOk } from "./ConcluidasTable";
import { applyFilters, type DobraFilters } from "./filters";
import {
  isDobrada,
  buildCargaDiaria,
  buildProducaoDiaria,
  capacidadeTotalSeg,
  secToHms,
  type Capacidade,
  type CargaDia,
  type MetaParams,
  useDobraSettings,
  type RgCalc,
} from "@/lib/dobra";
import { useDobraControleRg, slaExibido } from "@/lib/dobraExtra";

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
  const [alerta, setAlerta] = useState<{ label: string; rows: RgCalc[] } | null>(null);
  const { data: ctrl } = useDobraControleRg();
  const { data: cfg } = useDobraSettings();
  const slaSalvo = cfg?.slaMensal ?? {};

  const pecasPorRg = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of ctrl ?? []) if (c.rg_key) m.set(c.rg_key, (m.get(c.rg_key) ?? 0) + (c.quantidade ?? 0));
    return m;
  }, [ctrl]);

  const abertas = useMemo(() => applyFilters(rows, filters).filter((r) => !isDobrada(r.situacao)), [rows, filters]);
  const concluidas = useMemo(
    () => applyFilters(rows.filter((r) => isDobrada(r.situacao)), filters, "data_dobra"),
    [rows, filters],
  );

  /* SLA do mês — coluna SLA da planilha (OK / Não OK), mesma base do widget. */
  const slaMes = useMemo(() => {
    const base = ctrl ?? [];
    const ultimo = base.reduce<string>((mx, c) => (c.data_conclusao && c.data_conclusao > mx ? c.data_conclusao : mx), "");
    const mes = (filters.dataFim || filters.dataIni || ultimo || new Date().toISOString().slice(0, 10)).slice(0, 7);
    const r = slaExibido(base, `${mes}-01`, `${mes}-31`, slaSalvo);
    return { mes, pct: r.pct, ok: r.ok, total: r.total, oficial: r.oficial };
  }, [ctrl, filters.dataIni, filters.dataFim, slaSalvo]);


  const kpis = useMemo(() => {
    const avaliadas = concluidas.filter((r) => slaOk(r) !== null);
    const sla = avaliadas.length ? (avaliadas.filter((r) => slaOk(r) === true).length / avaliadas.length) * 100 : 0;
    const horas = concluidas.reduce((s, r) => s + r.tempoEstimadoSeg, 0);
    const dias = new Set(concluidas.map((r) => r.data_conclusao).filter(Boolean)).size || 1;
    return {
      sla,
      rgs: concluidas.length,
      pecas: concluidas.reduce((s, r) => s + (pecasPorRg.get(r.rg_key) ?? 0), 0),
      horas,
      media: concluidas.length / dias,
      pendentes: abertas.filter((r) => r.situacao === "aguardando" || r.situacao === "disponivel").length,
      emProducao: abertas.filter((r) => r.situacao === "em_producao").length,
      disponiveis: abertas.filter((r) => r.situacao === "disponivel").length,
      aguardando: abertas.filter((r) => r.situacao === "aguardando").length,
      atrasadas: abertas.filter((r) => r.atrasada).length,
    };
  }, [concluidas, abertas, pecasPorRg]);

  /* Produção por período — últimos 14 dias com conclusão */
  const producao = useMemo(() => buildProducaoDiaria(concluidas, pecasPorRg), [concluidas, pecasPorRg]);

  /* Carga de dobra por dia — próximos 7 dias */
  const capSeg = capacidadeTotalSeg(capacidade);
  const carga = useMemo(() => buildCargaDiaria(abertas, capSeg), [abertas, capSeg]);

  const alertas = useMemo(
    () =>
      [
        { label: "RGs atrasadas", rows: abertas.filter((r) => r.atrasada), detail: "Data de planejamento vencida" },
        { label: "RGs sem FPP/FPG", rows: abertas.filter((r) => !r.fpp_key), detail: "Sem vínculo com pacote" },
        { label: "RGs sem tempo estimado", rows: abertas.filter((r) => !r.tempoEstimadoSeg), detail: "FPP sem tempo" },
        { label: "RGs sem tarefa descrição", rows: abertas.filter((r) => !r.tarefa_desc), detail: "Aguardando etapa anterior" },
        { label: "RGs sem data de planejamento", rows: abertas.filter((r) => !r.data_planejamento), detail: "Sem prazo definido" },
      ]
        .map((a) => ({ ...a, n: a.rows.length }))
        .filter((a) => a.n > 0),
    [abertas],
  );

  const diasSobrecarga = carga.filter((c) => c.util > 100).length;


  const barColor = (u: number) => (u > 100 ? "var(--destructive)" : u >= 85 ? "var(--warning)" : "var(--success)");

  const tooltipProps = {
    contentStyle: {
      background: "var(--popover)",
      border: "1px solid var(--border)",
      borderRadius: 8,
      color: "var(--popover-foreground)",
    },
    labelStyle: { color: "var(--popover-foreground)", fontWeight: 600 },
    itemStyle: { color: "var(--popover-foreground)" },
    cursor: { fill: "color-mix(in oklab, var(--foreground) 8%, transparent)" },
  } as const;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-6">
        <Kpi
          label={`SLA ${slaMes.mes.slice(5)}/${slaMes.mes.slice(2, 4)}`}
          value={`${slaMes.pct.toFixed(2)}%`}
          sub={slaMes.oficial ? `SLA da planilha · meta ${meta.metaSla}%` : slaMes.total ? `${slaMes.ok}/${slaMes.total} RGs no prazo · meta ${meta.metaSla}%` : "Sem controle de RG no mês"}
          tone={slaMes.pct >= meta.metaSla ? "success" : "destructive"}
        />

        <Kpi label="RGs produzidas" value={kpis.rgs} sub="No período" tone="primary" onClick={() => onVerTodas("concluidas")} />
        <Kpi label="Peças produzidas" value={kpis.pecas.toLocaleString("pt-BR")} sub="Quantidade do controle de RG" />
        <Kpi label="Horas produzidas" value={secToHms(kpis.horas)} sub="Tempo estimado das RGs concluídas" tone="primary" />
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
          <p className="px-4 pt-3 text-xs text-muted-foreground">
            Últimos 14 dias com conclusão de RG. Barras mostram {serie === "horas" ? "as horas estimadas produzidas" : serie === "pecas" ? "as peças concluídas" : "a quantidade de RGs"} por dia e a linha compara sempre o volume de RGs; a linha tracejada é a meta de {meta.metaRgsDia} RGs/dia.
          </p>
          <div className="h-64 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={producao}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <Tooltip {...tooltipProps} />
                <Bar dataKey={serie} fill="var(--chart-1)" radius={[4, 4, 0, 0]} name={serie === "horas" ? "Horas" : serie === "pecas" ? "Peças" : "RGs"} />
                {serie === "rgs" && <ReferenceLine y={meta.metaRgsDia} stroke="var(--destructive)" strokeDasharray="4 4" />}
                <Line type="monotone" dataKey="rgs" stroke="var(--chart-2)" dot={false} name="RGs" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
            {producao.length} dia(s) · RGs: <b className="text-foreground">{producao.reduce((s, p) => s + p.rgs, 0)}</b> · Peças:{" "}
            <b className="text-foreground">{producao.reduce((s, p) => s + p.pecas, 0).toLocaleString("pt-BR")}</b> · Horas:{" "}
            <b className="text-foreground">{producao.reduce((s, p) => s + p.horas, 0).toFixed(1)}h</b>
          </div>
        </Card>

        <Card title="Carga de dobra por dia (próximos 7 dias)">
          <p className="px-4 pt-3 text-xs text-muted-foreground">
            Horas necessárias por dia contra a capacidade de {(capSeg / 3600).toFixed(1)}h (linha tracejada). O primeiro dia acumula tudo que está atrasado ou sem data e o último dia acumula tudo com data posterior. Verde = folga, amarelo ≥ 85%, vermelho acima da capacidade.
          </p>
          <div className="h-64 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={carga}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <Tooltip
                  {...tooltipProps}
                  formatter={(v: number, n: string) => [n === "util" ? `${v}%` : `${v}h`, n === "horas" ? "Horas programadas" : n === "capacidade" ? "Capacidade" : "Utilização"]}
                  labelFormatter={(l: string) => {
                    const d = carga.find((c) => c.label === l);
                    return d ? `${l} — ${d.rgs} RGs · ${d.fpps} FPPs · ${d.util}% da capacidade` : l;
                  }}
                />
                <ReferenceLine y={capSeg / 3600} stroke="var(--destructive)" strokeDasharray="4 4" />
                <Bar dataKey="horas" name="Horas programadas" radius={[4, 4, 0, 0]}>
                  {carga.map((c: CargaDia, i: number) => (
                    <Cell key={i} fill={barColor(c.util)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
            Total programado: <b className="text-foreground">{carga.reduce((s, c) => s + c.horas, 0).toFixed(1)}h</b> · RGs:{" "}
            <b className="text-foreground">{carga.reduce((s, c) => s + c.rgs, 0)}</b> · Dias acima da capacidade:{" "}
            <b className="text-foreground">{carga.filter((c) => c.util > 100).length}</b>
          </div>
        </Card>
      </div>

      {(alertas.length > 0 || diasSobrecarga > 0) && (
        <Card title="Alertas importantes">
          <div className="divide-y divide-border">
            {alertas.map((a) => (
              <button
                key={a.label}
                onClick={() => setAlerta({ label: a.label, rows: a.rows })}
                className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-secondary/50"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <AlertTriangle className="size-4 shrink-0 text-accent" />
                  <span className="truncate">{a.label}</span>
                  <span className="hidden truncate text-xs text-muted-foreground sm:inline">— {a.detail} · clique para ver a lista</span>
                </span>
                <span className="shrink-0 rounded-md bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent tabular-nums">{a.n}</span>
              </button>
            ))}
            {diasSobrecarga > 0 && (
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <AlertTriangle className="size-4 shrink-0 text-accent" />
                  <span className="truncate">Carga acima da capacidade</span>
                  <span className="hidden truncate text-xs text-muted-foreground sm:inline">— dias com sobrecarga nos próximos 7 dias</span>
                </span>
                <span className="shrink-0 rounded-md bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent tabular-nums">{diasSobrecarga}</span>
              </div>
            )}
          </div>
        </Card>
      )}

      {alerta && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" onClick={() => setAlerta(null)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative max-h-[85vh] w-full max-w-5xl overflow-auto rounded-xl border border-border bg-card"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="sticky top-0 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-card px-4 py-3">
              <div className="min-w-0">
                <div className="truncate font-semibold">{alerta.label}</div>
                <div className="text-xs text-muted-foreground">{alerta.rows.length} RG(s) neste alerta</div>
              </div>
              <button onClick={() => setAlerta(null)} className="rounded p-1.5 hover:bg-secondary">
                <X className="size-4" />
              </button>
            </header>
            <EmAbertoTable rows={alerta.rows} pageSize={15} />
          </div>
        </div>
      )}

    </div>
  );
}
