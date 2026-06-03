import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KpiCard } from "@/components/KpiCard";
import { Gauge } from "@/components/Gauge";
import { fmtInt, fmtNum, fmtDate } from "@/lib/format";
import {
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, LabelList, ReferenceLine,
} from "recharts";
import { Zap, Clock, Gauge as GaugeIcon, Factory, RefreshCw, ListChecks, ChevronDown, ChevronUp, Scissors, LayoutGrid, CalendarDays, TrendingUp } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface ProdRecord {
  id: string;
  fpp: string | null;
  dt_prog: string | null;
  seq: number | null;
  produto: string | null;
  linha: string | null;
  cliente: string | null;
  item: string | null;
  data_rg: string | null;
  dt_pacote: string | null;
  dt_fim_prog: string | null;
  dt_fim_estamparia: string | null;
  dt_fim_agrup: string | null;
  tempo_fpp_seg: number | null;
  maquina: number | null;
  tempo_execucao_seg: number | null;
}

const MACHINES = [2000, 3000, 5000] as const;
const WEEKLY_CAPACITY_HOURS = 75; // h por máquina por semana
const ATRAVESSAMENTO_LIMITE_DIAS = 3;
const META_ATRAVESSAMENTO = 90; // %

function isUrgente(r: ProdRecord) {
  return (r.produto ?? "").toUpperCase().includes("URGENTE");
}

async function fetchAllProduction(): Promise<ProdRecord[]> {
  const pageSize = 1000;
  let from = 0;
  const all: ProdRecord[] = [];
  while (true) {
    const { data, error } = await supabase.from("production_records").select("*")
      .order("dt_prog", { ascending: false }).range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as ProdRecord[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

function fmtHM(seg: number): string {
  if (!Number.isFinite(seg) || seg < 0) return "0h";
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function startOfWeek(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = x.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  x.setDate(x.getDate() + diff);
  return x;
}
function sameWeek(a: Date, b: Date) { return startOfWeek(a).getTime() === startOfWeek(b).getTime(); }
function sameMonth(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth(); }
function sameYear(a: Date, b: Date) { return a.getFullYear() === b.getFullYear(); }
function sameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }

const CURITIBA_FIXED_HOLIDAYS = new Set(["01-01", "03-29", "04-21", "05-01", "09-07", "09-08", "10-12", "11-02", "11-15", "11-20", "12-19", "12-25"]);

function ymd(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function md(date: Date) { return ymd(date).slice(5); }

function parseLocalDate(value: string | null): Date | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function easterDate(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function holidaySetForYear(year: number) {
  const easter = easterDate(year);
  const dates = new Set<string>();
  CURITIBA_FIXED_HOLIDAYS.forEach((day) => dates.add(`${year}-${day}`));
  [-48, -47, -46, -2, 60].forEach((offset) => dates.add(ymd(addDays(easter, offset))));

  Array.from(dates).forEach((day) => {
    const [y, m, d] = day.split("-").map(Number);
    const holiday = new Date(y, m - 1, d);
    if (holiday.getDay() === 2) dates.add(ymd(addDays(holiday, -1))); // feriado na terça: emenda segunda
    if (holiday.getDay() === 4) dates.add(ymd(addDays(holiday, 1))); // feriado na quinta: emenda sexta
  });

  return dates;
}

function isWorkingDay(date: Date) {
  const day = date.getDay();
  if (day === 0 || day === 6) return false;
  return !holidaySetForYear(date.getFullYear()).has(ymd(date));
}

/** Atravessamento calculado entre Data Prog. (B) e Data Fim Prog. (K), descontando fins de semana, feriados de Curitiba e dias ponte. */
function atravessDias(dtProg: string | null, dtFimProg: string | null): number | null {
  const start = parseLocalDate(dtProg);
  const end = parseLocalDate(dtFimProg);
  if (!start || !end) return null;
  const forward = end.getTime() >= start.getTime();
  let cursor = new Date(start);
  let days = 0;

  while (forward ? cursor < end : cursor > end) {
    cursor = addDays(cursor, forward ? 1 : -1);
    if (isWorkingDay(cursor)) days += 1;
  }

  return days;
}

export function ProductionDashboard() {
  const { data: records = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["production_records"], queryFn: fetchAllProduction,
  });

  const [machineFilter, setMachineFilter] = useState<string>(""); // "" all, or "2000"
  const [urgencyFilter, setUrgencyFilter] = useState<string>(""); // "", "urg", "nor"
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [showTable, setShowTable] = useState(false);
  const [detail, setDetail] = useState<null | { title: string; rows: { label: string; value: string }[] }>(null);

  const now = useMemo(() => new Date(), []);
  const fromDate = useMemo(() => parseLocalDate(dateFrom), [dateFrom]);
  const toDate = useMemo(() => parseLocalDate(dateTo), [dateTo]);

  const rangeLabel = useMemo(() => {
    if (fromDate && toDate) return `${fmtDate(dateFrom)} – ${fmtDate(dateTo)}`;
    if (fromDate) return `desde ${fmtDate(dateFrom)}`;
    if (toDate) return `até ${fmtDate(dateTo)}`;
    return "todo o período";
  }, [fromDate, toDate, dateFrom, dateTo]);

  const setPreset = (days: number | "all" | "today") => {
    if (days === "all") { setDateFrom(""); setDateTo(""); return; }
    const end = new Date();
    setDateTo(ymd(end));
    if (days === "today") { setDateFrom(ymd(end)); return; }
    setDateFrom(ymd(addDays(end, -(days - 1))));
  };

  // Filtro base: máquina + urgência (intervalo de datas é aplicado em inPeriod)
  const filtered = useMemo(() => {
    return records.filter(r => {
      if (machineFilter && String(r.maquina ?? "") !== machineFilter) return false;
      if (urgencyFilter) {
        const isUrg = isUrgente(r);
        if (urgencyFilter === "urg" && !isUrg) return false;
        if (urgencyFilter === "nor" && isUrg) return false;
      }
      return true;
    });
  }, [records, machineFilter, urgencyFilter]);

  // Registros dentro do intervalo de datas selecionado (por Data Prog. / dt_prog)
  const inPeriod = useMemo(() => {
    return filtered.filter(r => {
      const ref = parseLocalDate(r.dt_prog);
      if (!ref) return false;
      if (fromDate && ref < fromDate) return false;
      if (toDate && ref > toDate) return false;
      return true;
    });
  }, [filtered, fromDate, toDate]);

  // Tempos urgentes vs normais (em segundos) por bucket — usado nos diálogos de detalhe
  const tempos = useMemo(() => {
    const acc = {
      urg: { day: 0, week: 0, month: 0, year: 0, total: 0 },
      nor: { day: 0, week: 0, month: 0, year: 0, total: 0 },
    };
    filtered.forEach(r => {
      const seg = r.tempo_fpp_seg ?? 0;
      if (seg <= 0) return;
      const ref = parseLocalDate(r.dt_prog);
      if (!ref) return;
      const tgt = isUrgente(r) ? acc.urg : acc.nor;
      tgt.total += seg;
      if (sameDay(ref, now)) tgt.day += seg;
      if (sameWeek(ref, now)) tgt.week += seg;
      if (sameMonth(ref, now)) tgt.month += seg;
      if (sameYear(ref, now)) tgt.year += seg;
    });
    return acc;
  }, [filtered, now]);

  // Somas do intervalo selecionado (para as pílulas)
  const urgPeriod = useMemo(() => inPeriod.filter(isUrgente).reduce((s, r) => s + (r.tempo_fpp_seg ?? 0), 0), [inPeriod]);
  const norPeriod = useMemo(() => inPeriod.filter(r => !isUrgente(r)).reduce((s, r) => s + (r.tempo_fpp_seg ?? 0), 0), [inPeriod]);

  // Capacidade dimensionada pela quantidade de semanas dentro do intervalo
  const rangeWeeks = useMemo(() => {
    if (fromDate && toDate) {
      const days = Math.max(1, Math.round((toDate.getTime() - fromDate.getTime()) / 86400000) + 1);
      return Math.max(1, days / 7);
    }
    return 52;
  }, [fromDate, toDate]);
  const capLimitHours = WEEKLY_CAPACITY_HOURS * rangeWeeks;

  // Capacidade por máquina (no intervalo selecionado)
  const capacityByMachine = useMemo(() => {
    const list = machineFilter ? [Number(machineFilter)] : [...MACHINES];
    return list.map(m => {
      let urg = 0, nor = 0;
      inPeriod.forEach(r => {
        if ((r.maquina ?? 0) !== m) return;
        const seg = r.tempo_fpp_seg ?? 0;
        if (seg <= 0) return;
        if (isUrgente(r)) urg += seg; else nor += seg;
      });
      const used = urg + nor;
      const free = Math.max(0, capLimitHours * 3600 - used);
      const occ = capLimitHours > 0 ? (used / (capLimitHours * 3600)) * 100 : 0;
      return {
        machine: `Máq ${m}`,
        Urgente: +(urg / 3600).toFixed(2),
        Normal: +(nor / 3600).toFixed(2),
        Livre: +(free / 3600).toFixed(2),
        occ,
        used: +(used / 3600).toFixed(2),
      };
    });
  }, [inPeriod, machineFilter, capLimitHours]);

  // Atravessamento: dias úteis entre Data Prog. (B) e Data Fim Prog. (K) ≤ 3 (no intervalo)
  const atravess = useMemo(() => {
    let dentro = 0, total = 0;
    const detalhes: { fpp: string | null; dias: number; dentro: boolean; dt_prog: string | null; dt_fim_prog: string | null }[] = [];
    inPeriod.forEach(r => {
      const dias = atravessDias(r.dt_prog, r.dt_fim_prog);
      if (dias === null) return;
      total++;
      const ok = dias <= ATRAVESSAMENTO_LIMITE_DIAS;
      if (ok) dentro++;
      detalhes.push({ fpp: r.fpp, dias: +dias.toFixed(0), dentro: ok, dt_prog: r.dt_prog, dt_fim_prog: r.dt_fim_prog });
    });
    return { pct: total > 0 ? (dentro / total) * 100 : 0, dentro, total, detalhes: detalhes.sort((a, b) => b.dias - a.dias) };
  }, [inPeriod]);

  // Contagem de FPPs (distintas) por bucket — usado nos diálogos
  const fppCounts = useMemo(() => {
    const sets = {
      day: new Set<string>(), week: new Set<string>(), month: new Set<string>(), year: new Set<string>(), total: new Set<string>(),
    };
    filtered.forEach(r => {
      if (!r.fpp) return;
      const ref = parseLocalDate(r.dt_prog);
      if (!ref) return;
      sets.total.add(r.fpp);
      if (sameDay(ref, now)) sets.day.add(r.fpp);
      if (sameWeek(ref, now)) sets.week.add(r.fpp);
      if (sameMonth(ref, now)) sets.month.add(r.fpp);
      if (sameYear(ref, now)) sets.year.add(r.fpp);
    });
    return { day: sets.day.size, week: sets.week.size, month: sets.month.size, year: sets.year.size, total: sets.total.size };
  }, [filtered, now]);

  // Distintas no intervalo selecionado (para as pílulas)
  const fppPeriod = useMemo(() => new Set(inPeriod.map(r => r.fpp).filter(Boolean)).size, [inPeriod]);

  const openTempoDetail = (kind: "urg" | "nor") => {
    const data = tempos[kind];
    setDetail({
      title: kind === "urg" ? "Tempo de Urgência" : "Horas Normais",
      rows: [
        { label: "Intervalo selecionado", value: fmtHM(kind === "urg" ? urgPeriod : norPeriod) },
        { label: "Hoje", value: fmtHM(data.day) },
        { label: "Semana atual", value: fmtHM(data.week) },
        { label: "Mês atual", value: fmtHM(data.month) },
        { label: "Ano atual", value: fmtHM(data.year) },
        { label: "Total no banco", value: fmtHM(data.total) },
      ],
    });
  };

  const openFppDetail = (title: string) => {
    setDetail({
      title,
      rows: [
        { label: "Intervalo selecionado", value: fmtInt(fppPeriod) },
        { label: "Hoje", value: fmtInt(fppCounts.day) },
        { label: "Semana", value: fmtInt(fppCounts.week) },
        { label: "Mês", value: fmtInt(fppCounts.month) },
        { label: "Ano", value: fmtInt(fppCounts.year) },
        { label: "Total no banco", value: fmtInt(fppCounts.total) },
      ],
    });
  };


  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Painel de Programação & Capacidade</h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            {isLoading ? "Carregando…" : `${fmtInt(records.length)} registros de produção`}
          </p>
        </div>
        <button onClick={() => refetch()} className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-secondary">
          <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Atualizar</span>
        </button>
      </header>

      {/* Filtros */}
      <section className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">De</label>
          <input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Até</label>
          <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm" />
        </div>
        <div className="inline-flex rounded-md border border-border bg-card p-1">
          <button onClick={() => setPreset("today")} className="px-3 py-1.5 text-sm rounded text-muted-foreground hover:text-foreground">Hoje</button>
          <button onClick={() => setPreset(7)} className="px-3 py-1.5 text-sm rounded text-muted-foreground hover:text-foreground">7 dias</button>
          <button onClick={() => setPreset(30)} className="px-3 py-1.5 text-sm rounded text-muted-foreground hover:text-foreground">30 dias</button>
          <button onClick={() => setPreset("all")} className="px-3 py-1.5 text-sm rounded text-muted-foreground hover:text-foreground">Tudo</button>
        </div>
        <select value={machineFilter} onChange={(e) => setMachineFilter(e.target.value)}
          className="rounded-md border border-border bg-card px-3 py-2 text-sm">
          <option value="">Todas as máquinas</option>
          {MACHINES.map(m => <option key={m} value={String(m)}>Máquina {m}</option>)}
        </select>
        <select value={urgencyFilter} onChange={(e) => setUrgencyFilter(e.target.value)}
          className="rounded-md border border-border bg-card px-3 py-2 text-sm">
          <option value="">Urgente + Normal</option>
          <option value="urg">Somente urgentes</option>
          <option value="nor">Somente normais</option>
        </select>
      </section>

      {/* Pílulas principais */}
      <section className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <KpiCard label="Tempo de Urgência" value={fmtHM(urgPeriod)} icon={Zap} accent="destructive"
          hint={`Mês ${fmtHM(tempos.urg.month)} · Ano ${fmtHM(tempos.urg.year)}`}
          onClick={() => openTempoDetail("urg")} />
        <KpiCard label="Horas Normais" value={fmtHM(norPeriod)} icon={Clock} accent="primary"
          hint={`Mês ${fmtHM(tempos.nor.month)} · Ano ${fmtHM(tempos.nor.year)}`}
          onClick={() => openTempoDetail("nor")} />
        <KpiCard label="Programação Punch" value={fmtInt(fppPeriod)} icon={Scissors} accent="warning"
          hint={`${fmtInt(fppPeriod)} FPPs · mesmo dado (sem separação ainda)`}
          onClick={() => openFppDetail("Programação Punch (FPPs)")} />
        <KpiCard label="Programação Nest" value={fmtInt(fppPeriod)} icon={LayoutGrid} accent="accent"
          hint={`${fmtInt(fppPeriod)} FPPs · mesmo dado (sem separação ainda)`}
          onClick={() => openFppDetail("Programação Nest (FPPs)")} />
        <KpiCard label="FPPs" value={fmtInt(fppPeriod)} icon={Factory} accent="primary"
          hint={`Hoje ${fmtInt(fppCounts.day)} · Total ${fmtInt(fppCounts.total)}`}
          onClick={() => openFppDetail("FPPs por período")} />

        <KpiCard label="Atravessamento ≤ 3 dias" value={`${atravess.pct.toFixed(1)}%`} icon={GaugeIcon} accent="success"
          hint={`${fmtInt(atravess.dentro)} de ${fmtInt(atravess.total)} FPPs`}
          onClick={() => setDetail({
            title: "Atravessamento",
            rows: [
              { label: "Dentro do prazo (≤ 3 dias)", value: fmtInt(atravess.dentro) },
              { label: "Total avaliado", value: fmtInt(atravess.total) },
              { label: "Aderência", value: `${atravess.pct.toFixed(2)}%` },
              { label: "Meta", value: `${META_ATRAVESSAMENTO}%` },
            ],
          })} />
      </section>

      {/* Capacidade por máquina + velocímetro */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
              Capacidade · {rangeLabel} ({Math.round(capLimitHours)}h por máquina)
            </h3>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-sm" style={{ background: "oklch(0.62 0.23 25)" }} /> Urgente</span>
              <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-sm" style={{ background: "oklch(0.72 0.15 215)" }} /> Normal</span>
              <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-sm" style={{ background: "oklch(0.45 0.02 240)" }} /> Livre</span>
            </div>
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer>
              <BarChart data={capacityByMachine} layout="vertical" margin={{ left: 30, right: 80, top: 10, bottom: 10 }}>
                <CartesianGrid stroke="oklch(0.3 0.03 250)" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, Math.round(capLimitHours)]} tickFormatter={(v) => `${v}h`} stroke="oklch(0.72 0.03 240)" fontSize={11} />
                <YAxis type="category" dataKey="machine" stroke="oklch(0.85 0.02 240)" fontSize={12} width={80} />
                <Tooltip
                  contentStyle={{ background: "oklch(0.22 0.04 250)", border: "1px solid oklch(0.3 0.03 250)", borderRadius: 8, color: "oklch(0.97 0.01 240)" }}
                  formatter={(v: number, n) => [`${v.toFixed(1)}h`, n]}
                />
                <Bar dataKey="Urgente" stackId="a" fill="oklch(0.62 0.23 25)" />
                <Bar dataKey="Normal" stackId="a" fill="oklch(0.72 0.15 215)" />
                <Bar dataKey="Livre" stackId="a" fill="oklch(0.45 0.02 240)">
                  <LabelList
                    dataKey="occ"
                    position="right"
                    content={((props: Record<string, unknown>) => {
                      const x = Number(props.x ?? 0);
                      const y = Number(props.y ?? 0);
                      const width = Number(props.width ?? 0);
                      const height = Number(props.height ?? 0);
                      const idx = Number(props.index ?? 0);
                      const d = capacityByMachine[idx];
                      if (!d) return null;
                      const pct = d.occ;
                      const color = pct >= 90 ? "oklch(0.62 0.23 25)" : pct >= 70 ? "oklch(0.85 0.18 90)" : "oklch(0.65 0.18 145)";
                      return (
                        <g>
                          <rect x={x + width + 6} y={y + height / 2 - 11} rx={4} width={62} height={22} fill={color} />
                          <text x={x + width + 6 + 31} y={y + height / 2 + 4} textAnchor="middle" fontSize={12} fontWeight={700} fill="oklch(0.99 0 0)">
                            {`${pct.toFixed(0)}%`}
                          </text>
                        </g>
                      );
                    }) as never}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-3">Atravessamento (≤ {ATRAVESSAMENTO_LIMITE_DIAS} dias)</h3>
          <div className="flex flex-col items-center justify-center h-[320px]">
            <Gauge value={atravess.pct} goal={META_ATRAVESSAMENTO} size={240} />
            <div className="mt-2 text-xs text-muted-foreground text-center">
              {fmtInt(atravess.dentro)} de {fmtInt(atravess.total)} FPPs no prazo
              <br />
              <span className="text-[11px]">Meta {META_ATRAVESSAMENTO}%</span>
            </div>
          </div>
        </div>
      </section>

      {/* Tabela escondida */}
      <section className="bg-card border border-border rounded-xl">
        <button onClick={() => setShowTable(s => !s)}
          className="w-full px-4 py-3 flex items-center justify-between text-sm font-semibold uppercase tracking-wider text-muted-foreground hover:bg-secondary/30 transition-colors rounded-xl">
          <span className="flex items-center gap-2"><ListChecks className="size-4" /> Detalhes de Atravessamento por FPP</span>
          {showTable ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
        {showTable && (
          <div className="overflow-auto max-h-[420px] border-t border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 sticky top-0">
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2">FPP</th>
                  <th className="px-3 py-2">Data Prog. (B)</th>
                  <th className="px-3 py-2">Data Fim Prog. (K)</th>
                  <th className="px-3 py-2 text-right">Dias</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {atravess.detalhes.slice(0, 500).map((d, i) => (
                  <tr key={i} className="border-t border-border hover:bg-secondary/30">
                    <td className="px-3 py-2 font-mono text-xs">{d.fpp}</td>
                    <td className="px-3 py-2 text-xs">{fmtDate(d.dt_prog)}</td>
                    <td className="px-3 py-2 text-xs">{fmtDate(d.dt_fim_prog)}</td>
                    <td className="px-3 py-2 text-right font-mono">{d.dias.toFixed(1)}</td>
                    <td className="px-3 py-2">
                      <span className={`text-xs font-semibold ${d.dentro ? "text-success" : "text-destructive"}`}>
                        {d.dentro ? "Dentro" : "Fora"}
                      </span>
                    </td>
                  </tr>
                ))}
                {atravess.detalhes.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Sem dados para avaliação.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="text-xs text-muted-foreground">
        * Capacidade considera o intervalo de datas selecionado (por Data Prog.) e o campo TEMPO FPP da planilha (75h/semana por máquina).
        Urgente = PRODUTO contém "URGENTE". Atravessamento = dias úteis entre Data Prog. (B) e Data Fim Prog. (K), descontando fins de semana, feriados de Curitiba e dias ponte; dentro do prazo quando ≤ {ATRAVESSAMENTO_LIMITE_DIAS} dias.
        Sem datas selecionadas, mostra todo o período disponível.
        Punch e Nest ainda usam o mesmo dado até a planilha trazer essa separação.
      </div>


      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{detail?.title}</DialogTitle>
            <DialogDescription>Detalhamento por período</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            {detail?.rows.map((r, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <span className="text-sm text-muted-foreground">{r.label}</span>
                <span className="font-mono font-semibold">{r.value}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Silence eslint: fmtNum used elsewhere
void fmtNum;
