import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KpiCard } from "@/components/KpiCard";
import { Gauge } from "@/components/Gauge";
import { fmtInt, fmtNum, fmtDate } from "@/lib/format";
import {
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, LabelList, ReferenceLine,
} from "recharts";
import { Zap, Clock, Gauge as GaugeIcon, Factory, RefreshCw, ListChecks, ChevronDown, ChevronUp, Scissors, LayoutGrid, TrendingUp } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { usePersistentState } from "@/lib/persistentState";
import { useDobraRgs } from "@/lib/dobra";


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
const WEEKLY_CAPACITY_HOURS = 64; // h por máquina por semana
const ATRAVESSAMENTO_META_DIAS = 2; // dias úteis de antecedência considerados ideais
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

/**
 * Atravessamento (em dias úteis) = DT FIM PROGRAMAÇÃO (col. K) − Data Prog. (col. B),
 * desconsiderando finais de semana, feriados de Curitiba e dias-ponte.
 * POSITIVO  → terminou antes do prazo (adiantado).
 * NEGATIVO  → atrasado.
 * ZERO      → no prazo (Ok).
 */
function businessDaysBetween(a: Date, b: Date): number {
  // dias úteis estritamente entre a e b (a < b), contando o dia final mas não o inicial
  let cnt = 0;
  const d = new Date(a);
  while (d.getTime() < b.getTime()) {
    d.setDate(d.getDate() + 1);
    if (isWorkingDay(d)) cnt++;
  }
  return cnt;
}

/** Dias úteis no intervalo [a, b], inclusive ambos. */
function workingDaysInRange(a: Date, b: Date): number {
  let cnt = 0;
  const d = new Date(a);
  while (d.getTime() <= b.getTime()) {
    if (isWorkingDay(d)) cnt++;
    d.setDate(d.getDate() + 1);
  }
  return cnt;
}
function atravessDias(dtProg: string | null, dtFimProg: string | null): number | null {
  // dtProg (col. B) = data em que efetivamente terminou
  // dtFimProg (col. K) = data em que deveria ter terminado (prazo)
  // resultado = K - B em dias úteis → positivo = adiantado, negativo = atrasado, zero = no prazo
  const entregue = parseLocalDate(dtProg);
  const prazo = parseLocalDate(dtFimProg);
  if (!entregue || !prazo) return null;
  if (entregue.getTime() === prazo.getTime()) return 0;
  return prazo.getTime() > entregue.getTime()
    ? businessDaysBetween(entregue, prazo)   // terminou antes do prazo → adiantado
    : -businessDaysBetween(prazo, entregue); // terminou depois do prazo → atrasado
}



export function ProductionDashboard() {
  const { data: records = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["production_records"], queryFn: fetchAllProduction,
  });
  // Base da Dobra reaproveitada aqui (RGs por data de planejamento)
  const { data: dobraRgs = [] } = useDobraRgs();


  const [machineFilter, setMachineFilter] = usePersistentState<string>("prog.prod.maquina", ""); // "" all, or "2000"
  const [urgencyFilter, setUrgencyFilter] = usePersistentState<string>("prog.prod.urgencia", ""); // "", "urg", "nor"
  // Datas compartilhadas com a aba Desperdícios (mesmo módulo Programação)
  const [dateFrom, setDateFrom] = usePersistentState<string>("prog.filtro.dataInicial", "");
  const [dateTo, setDateTo] = usePersistentState<string>("prog.filtro.dataFinal", "");

  const [showTable, setShowTable] = useState(false);
  const [detail, setDetail] = useState<null | { title: string; rows: { label: string; value: string }[]; fppLists?: { label: string; fpps: string[] }[] }>(null);
  const [capModalOpen, setCapModalOpen] = useState(false);
  const [fFpp, setFFpp] = useState("");
  const [fMaq, setFMaq] = useState("");
  const [fStatus, setFStatus] = useState("");


  const now = useMemo(() => new Date(), []);
  const fromDate = useMemo(() => parseLocalDate(dateFrom), [dateFrom]);
  const toDate = useMemo(() => parseLocalDate(dateTo), [dateTo]);

  const rangeLabel = useMemo(() => {
    if (fromDate && toDate) return `${fmtDate(dateFrom)} – ${fmtDate(dateTo)}`;
    if (fromDate) return `desde ${fmtDate(dateFrom)}`;
    if (toDate) return `até ${fmtDate(dateTo)}`;
    return "todo o período";
  }, [fromDate, toDate, dateFrom, dateTo]);




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

  // Atravessamento: dias úteis (com sinal) entre Data Prog. e DT FIM PROGRAMAÇÃO (col K)
  const atravess = useMemo(() => {
    let dentro = 0, total = 0, soma = 0;
    const detalhes: { fpp: string | null; dias: number; dentro: boolean; dt_prog: string | null; dt_fim_est: string | null; tempo: number | null; maquina: number | null }[] = [];
    inPeriod.forEach(r => {
      const dias = atravessDias(r.dt_prog, r.dt_fim_prog);
      if (dias === null) return;
      total++;
      soma += dias;
      const ok = dias >= 0; // no prazo ou adiantado
      if (ok) dentro++;
      detalhes.push({ fpp: r.fpp, dias, dentro: ok, dt_prog: r.dt_prog, dt_fim_est: r.dt_fim_prog, tempo: r.tempo_fpp_seg, maquina: r.maquina });
    });
    return { pct: total > 0 ? (dentro / total) * 100 : 0, dentro, total, media: total > 0 ? soma / total : 0, detalhes: detalhes.sort((a, b) => a.dias - b.dias) };
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

  // Série diária: Planejado (col. L = dt_fim_estamparia) vs Realizado (dt_prog).
  // IMPORTANTE: os dois usam `filtered` (base já filtrada por máquina/urgência) e
  // são restringidos APENAS pela sua própria data dentro de [fromDate, toDate].
  // Assim o valor de um dia X é sempre o mesmo, independente da largura do intervalo:
  // Realizado(X)  = FPPs distintas com dt_prog = X (e X é dia útil)
  // Planejado(X) = FPPs distintas com dt_fim_estamparia = X (e X é dia útil)
  const perDay = useMemo(() => {
    const inRange = (d: Date) => {
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    };
    const byDay = new Map<string, Set<string>>();          // realizado
    const plannedByDay = new Map<string, Set<string>>();   // planejado
    const byMachineDay = new Map<number, Map<string, Set<string>>>();
    const rgByDay = new Map<string, Set<string>>();        // RGs da dobra por data de planejamento

    filtered.forEach(r => {
      if (!r.fpp) return;
      const ref = parseLocalDate(r.dt_prog);
      if (ref && isWorkingDay(ref) && inRange(ref)) {
        const dk = ymd(ref);
        let s = byDay.get(dk);
        if (!s) { s = new Set(); byDay.set(dk, s); }
        s.add(r.fpp);
        const m = r.maquina ?? 0;
        let mm = byMachineDay.get(m);
        if (!mm) { mm = new Map(); byMachineDay.set(m, mm); }
        let ms = mm.get(dk);
        if (!ms) { ms = new Set(); mm.set(dk, ms); }
        ms.add(r.fpp);
      }
      const plan = parseLocalDate(r.dt_fim_estamparia);
      if (plan && isWorkingDay(plan) && inRange(plan)) {
        const pk = ymd(plan);
        let ps = plannedByDay.get(pk);
        if (!ps) { ps = new Set(); plannedByDay.set(pk, ps); }
        ps.add(r.fpp);
      }
    });

    // RGs vindos da base da Dobra — programados (data de planejamento) e realizados (data de conclusão)
    const rgRealByDay = new Map<string, Set<string>>();
    dobraRgs.forEach(r => {
      const id = r.rg_key || r.rg;
      const plan = parseLocalDate((r.data_planejamento ?? "").slice(0, 10) || null);
      if (plan && isWorkingDay(plan) && inRange(plan)) {
        const dk = ymd(plan);
        let s = rgByDay.get(dk);
        if (!s) { s = new Set(); rgByDay.set(dk, s); }
        s.add(id);
      }
      const done = parseLocalDate((r.data_conclusao ?? "").slice(0, 10) || null);
      if (done && isWorkingDay(done) && inRange(done)) {
        const dk = ymd(done);
        let s = rgRealByDay.get(dk);
        if (!s) { s = new Set(); rgRealByDay.set(dk, s); }
        s.add(id);
      }
    });

    const days = byDay.size;
    let total = 0;
    byDay.forEach(s => { total += s.size; });
    const perMachine = [...byMachineDay.entries()].map(([m, mm]) => {
      let t = 0;
      mm.forEach(s => { t += s.size; });
      return { machine: m, avg: mm.size > 0 ? t / mm.size : 0, days: mm.size };
    }).sort((a, b) => a.machine - b.machine);
    let rgTotal = 0;
    rgByDay.forEach(s => { rgTotal += s.size; });
    let rgRealTotal = 0;
    rgRealByDay.forEach(s => { rgRealTotal += s.size; });
    const rgDays = rgByDay.size;
    const allKeys = new Set<string>([...byDay.keys(), ...plannedByDay.keys(), ...rgByDay.keys(), ...rgRealByDay.keys()]);
    // Média = total realizado ÷ dias úteis DO FILTRO (ou do intervalo dos dados, sem filtro)
    const keys = Array.from(allKeys).sort((a, b) => a.localeCompare(b));
    const rangeStart = fromDate ?? (keys.length ? parseLocalDate(keys[0]) : null);
    const rangeEnd = toDate ?? (keys.length ? parseLocalDate(keys[keys.length - 1]) : null);
    const diasUteis = rangeStart && rangeEnd ? Math.max(1, workingDaysInRange(rangeStart, rangeEnd)) : Math.max(1, days);
    const avg = total / diasUteis;
    const rgAvg = rgRealTotal / diasUteis;
    const series = Array.from(allKeys)
      .sort((a, b) => a.localeCompare(b))
      .map((dk) => ({
        date: dk,
        label: dk.slice(8) + "/" + dk.slice(5, 7),
        count: byDay.get(dk)?.size ?? 0,
        planejado: plannedByDay.get(dk)?.size ?? 0,
        media: +avg.toFixed(2),
        rg: rgByDay.get(dk)?.size ?? 0,
        rgReal: rgRealByDay.get(dk)?.size ?? 0,
        rgs: Array.from(rgByDay.get(dk) ?? []),
        rgsReal: Array.from(rgRealByDay.get(dk) ?? []),
        fpps: Array.from(byDay.get(dk) ?? []),
        fppsPlanejado: Array.from(plannedByDay.get(dk) ?? []),
      }));
    return { avg, days, total, perMachine, series, rgAvg, rgTotal, rgRealTotal, rgDays, diasUteis };
  }, [filtered, fromDate, toDate, dobraRgs]);




  // Série da semana atual (ou últimos 7 dias úteis registrados se semana atual sem dados)
  const weekSeries = useMemo(() => {
    if (perDay.series.length === 0) return [] as typeof perDay.series;
    const monday = startOfWeek(now);
    const start = ymd(monday);
    const end = ymd(addDays(monday, 4));
    const wk = perDay.series.filter(p => p.date >= start && p.date <= end);
    return wk.length > 0 ? wk : perDay.series.slice(-7);
  }, [perDay.series, now]);





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

  const openAtravessDetail = (focus?: "ok" | "late") => {
    const late = atravess.detalhes.filter(d => d.dias < 0).map(d => d.fpp).filter(Boolean) as string[];
    const ok = atravess.detalhes.filter(d => d.dias >= 0).map(d => d.fpp).filter(Boolean) as string[];
    const lists = focus === "late"
      ? [{ label: "FPPs atrasadas", fpps: late }]
      : focus === "ok"
        ? [{ label: "FPPs no prazo / adiantadas", fpps: ok }]
        : [
            { label: "FPPs atrasadas", fpps: late },
            { label: "FPPs no prazo / adiantadas", fpps: ok },
          ];
    setDetail({
      title: focus === "late" ? "Atravessamento — FPPs atrasadas" : focus === "ok" ? "Atravessamento — FPPs no prazo" : "Atravessamento",
      rows: [
        { label: "No prazo / adiantado", value: fmtInt(atravess.dentro) },
        { label: "Atrasados", value: fmtInt(atravess.total - atravess.dentro) },
        { label: "Total avaliado", value: fmtInt(atravess.total) },
        { label: "Aderência", value: `${atravess.pct.toFixed(2)}%` },
        { label: "Média de atravessamento", value: `${atravess.media >= 0 ? "+" : ""}${fmtNum(atravess.media, 1)} dias úteis` },
        { label: "Meta de aderência", value: `${META_ATRAVESSAMENTO}%` },
        { label: "Meta de atravessamento", value: `${ATRAVESSAMENTO_META_DIAS} dias` },
      ],
      fppLists: lists,
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
      <section className="bg-card border border-border rounded-xl p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Data inicial</span>
            <input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} className={inputCls} />
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Data final</span>
            <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} className={inputCls} />
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Máquina</span>
            <select value={machineFilter} onChange={(e) => setMachineFilter(e.target.value)} className={inputCls}>
              <option value="">Todas as máquinas</option>
              {MACHINES.map(m => <option key={m} value={String(m)}>Máquina {m}</option>)}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Urgência</span>
            <select value={urgencyFilter} onChange={(e) => setUrgencyFilter(e.target.value)} className={inputCls}>
              <option value="">Urgente + Normal</option>
              <option value="urg">Somente urgentes</option>
              <option value="nor">Somente normais</option>
            </select>
          </label>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">Período: <span className="text-foreground font-medium">{rangeLabel}</span></span>
          <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
            Limpar datas
          </button>
        </div>
      </section>


      {/* Destaque — média de FPPs e de RGs por dia (capacidade média) */}
      <section className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        <div className="lg:col-span-1 bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 rounded-xl p-4 flex items-center gap-4">
          <div className="size-14 rounded-xl grid place-items-center bg-primary/20 text-primary shrink-0">
            <TrendingUp className="size-7" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Média de FPPs por dia</div>
            <div className="text-3xl font-extrabold leading-tight text-foreground">{fmtNum(perDay.avg, 1)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{fmtInt(perDay.total)} FPPs em {fmtInt(perDay.days)} dias úteis</div>
          </div>
        </div>
        <div className="lg:col-span-1 bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/30 rounded-xl p-4 flex items-center gap-4">
          <div className="size-14 rounded-xl grid place-items-center bg-accent/20 text-accent shrink-0">
            <ListChecks className="size-7" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Média de RGs por dia</div>
            <div className="text-3xl font-extrabold leading-tight text-foreground">{fmtNum(perDay.rgAvg, 1)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {fmtInt(perDay.rgRealTotal)} RGs realizadas ÷ {fmtInt(perDay.diasUteis)} dias úteis do filtro
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 grid grid-cols-2 gap-3">
          <KpiCard label="Programação Punch · méd/dia" value={fmtNum(perDay.avg, 1)} icon={Scissors} accent="warning"
            hint={`${fmtInt(fppPeriod)} FPPs no período · base única`}
            onClick={() => openFppDetail("Programação Punch (FPPs)")} />
          <KpiCard label="Programação Nest · méd/dia" value={fmtNum(perDay.avg, 1)} icon={LayoutGrid} accent="accent"
            hint={`${fmtInt(fppPeriod)} FPPs no período · base única`}
            onClick={() => openFppDetail("Programação Nest (FPPs)")} />
        </div>
      </section>

      {/* Mini gráfico — capacidade x realizado (semana atual). Clique abre o histórico completo. */}
      <section>
        <button type="button" onClick={() => setCapModalOpen(true)}
          className="w-full bg-card border border-border rounded-xl p-3 hover:border-primary/50 hover:bg-secondary/30 transition-colors text-left">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" />
              <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                Realidade × Capacidade média — semana atual
              </h3>
            </div>
            <div className="flex items-center gap-3 text-[11px] flex-wrap">
              <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: "oklch(0.72 0.15 215)" }} /> Planejado (DT Planejamento · col. L)</span>
              <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm border border-border" style={{ background: "rgb(236,235,228)" }} /> Realizado</span>
              <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: "oklch(0.78 0.16 75)" }} /> RG planejado</span>
              <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: "oklch(0.7 0.2 330)" }} /> RG realizado</span>
              <span className="text-muted-foreground">média = <span className="text-foreground font-semibold">{fmtNum(perDay.avg, 1)} FPP/dia</span></span>
              <span className="text-primary text-[10px] uppercase tracking-wider">clique p/ ver tudo →</span>
            </div>
          </div>
          <div className="h-[160px]">
            {weekSeries.length === 0 ? (
              <div className="h-full grid place-items-center text-xs text-muted-foreground">Sem registros na semana atual.</div>
            ) : (
              <ResponsiveContainer>
                <BarChart data={weekSeries} margin={{ left: 4, right: 8, top: 18, bottom: 4 }} barGap={4} barCategoryGap="18%">
                  <CartesianGrid stroke="oklch(0.3 0.03 250)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" stroke="oklch(0.72 0.03 240)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis hide allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: "oklch(0.22 0.04 250)", border: "1px solid oklch(0.3 0.03 250)", borderRadius: 8, color: "oklch(0.97 0.01 240)", fontSize: 12 }}
                    labelFormatter={(l) => `Dia ${l}`}
                    formatter={(v: number, name) => {
                      if (name === "planejado") return [`${v} FPPs`, "Para o dia (planejado)"];
                      if (name === "count") return [`${v} FPPs`, "Feito no dia"];
                      if (name === "rg") return [`${v}`, "RG planejado"];
                      if (name === "rgReal") return [`${v}`, "RG realizado"];
                      if (name === "media") return [`${fmtNum(v, 1)} FPPs`, "Média do período"];
                      return [`${v}`, name];
                    }}
                  />

                  <Bar dataKey="planejado" radius={[4, 4, 0, 0]} maxBarSize={22} fill="oklch(0.72 0.15 215)">
                    <LabelList dataKey="planejado" position="top" fill="oklch(0.85 0.05 215)" fontSize={10} fontWeight={600} />
                  </Bar>
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={22} fill="rgb(236,235,228)" stroke="oklch(0.4 0.02 250)" strokeWidth={0.5}>
                    <LabelList dataKey="count" position="top" fill="oklch(0.95 0.01 240)" fontSize={10} fontWeight={600} />
                  </Bar>
                  <Bar dataKey="rg" radius={[4, 4, 0, 0]} maxBarSize={14} fill="oklch(0.78 0.16 75)" />
                  <Bar dataKey="rgReal" radius={[4, 4, 0, 0]} maxBarSize={14} fill="oklch(0.7 0.2 330)" />
                  <ReferenceLine y={perDay.avg} stroke="oklch(0.78 0.16 75)" strokeDasharray="4 4" />
                  <ReferenceLine y={perDay.rgAvg} stroke="oklch(0.75 0.16 300)" strokeDasharray="2 4" />


                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </button>
      </section>


      {/* Pílulas principais — todas refletem o intervalo/máquina/urgência filtrados */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Tempo de Urgência" value={fmtHM(urgPeriod)} icon={Zap} accent="destructive"
          hint={`${rangeLabel} · ${fmtInt(inPeriod.filter(isUrgente).length)} registros`}
          onClick={() => openTempoDetail("urg")} />
        <KpiCard label="Horas Normais" value={fmtHM(norPeriod)} icon={Clock} accent="primary"
          hint={`${rangeLabel} · ${fmtInt(inPeriod.filter(r => !isUrgente(r)).length)} registros`}
          onClick={() => openTempoDetail("nor")} />
        <KpiCard label="FPPs no período" value={fmtInt(fppPeriod)} icon={Factory} accent="primary"
          hint={`${fmtNum(perDay.avg, 1)}/dia útil · ${rangeLabel}`}
          onClick={() => openFppDetail("FPPs por período")} />
        <KpiCard label="Atravessamento no prazo" value={`${atravess.pct.toFixed(1)}%`} icon={GaugeIcon} accent="success"
          hint={`Média ${atravess.media >= 0 ? "+" : ""}${fmtNum(atravess.media, 1)} d · ${fmtInt(atravess.dentro)}/${fmtInt(atravess.total)}`}
          onClick={() => openAtravessDetail()} />
      </section>


      {/* DESTAQUE: Velocímetro + Capacidade */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Velocímetro — atravessamento */}
        <div className="lg:col-span-2 bg-gradient-to-br from-card to-secondary/20 border border-border rounded-2xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-base uppercase tracking-wider text-foreground inline-flex items-center gap-2">
              <GaugeIcon className="size-5 text-primary" /> Atravessamento
            </h3>
            <span className="text-xs text-muted-foreground">Meta: {ATRAVESSAMENTO_META_DIAS} dias</span>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center">
            <Gauge value={atravess.pct} goal={META_ATRAVESSAMENTO} size={320} />
            <div className="mt-3 grid grid-cols-3 gap-2 w-full max-w-[320px]">
              <button type="button" onClick={() => openAtravessDetail("ok")}
                className="rounded-xl bg-success/10 border border-success/30 px-2 py-2 text-center hover:bg-success/20 transition-colors">
                <div className="text-xl font-extrabold text-success leading-none">{fmtInt(atravess.dentro)}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">No prazo</div>
              </button>
              <button type="button" onClick={() => openAtravessDetail("late")}
                className="rounded-xl bg-destructive/10 border border-destructive/30 px-2 py-2 text-center hover:bg-destructive/20 transition-colors">
                <div className="text-xl font-extrabold text-destructive leading-none">{fmtInt(atravess.total - atravess.dentro)}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Atrasados</div>
              </button>
              <div className="rounded-xl bg-muted/30 border border-border px-2 py-2 text-center">
                <div className={`text-xl font-extrabold leading-none ${atravess.media >= 0 ? "text-success" : "text-destructive"}`}>{atravess.media >= 0 ? "+" : ""}{fmtNum(atravess.media, 1)}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Média (d)</div>
              </div>
            </div>
          </div>
        </div>

        {/* Capacidade por máquina — barras verticais */}
        <div className="lg:col-span-3 bg-card border border-border rounded-2xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
            <h3 className="font-bold text-base uppercase tracking-wider text-foreground inline-flex items-center gap-2">
              <Factory className="size-5 text-primary" /> Capacidade por máquina
            </h3>
            <div className="flex items-center gap-4 text-xs">
              <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-sm" style={{ background: "oklch(0.62 0.23 25)" }} /> Urgente</span>
              <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-sm" style={{ background: "oklch(0.72 0.15 215)" }} /> Normal</span>
              <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-sm" style={{ background: "oklch(0.45 0.02 240)" }} /> Livre</span>
            </div>
          </div>
          <div className="h-[420px]">
            <ResponsiveContainer>
              <BarChart data={capacityByMachine} margin={{ left: 8, right: 16, top: 24, bottom: 8 }}>
                <defs>
                  <linearGradient id="capUrg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.68 0.23 25)" />
                    <stop offset="100%" stopColor="oklch(0.55 0.22 25)" />
                  </linearGradient>
                  <linearGradient id="capNor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.78 0.15 215)" />
                    <stop offset="100%" stopColor="oklch(0.64 0.16 215)" />
                  </linearGradient>
                  <linearGradient id="capLiv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.5 0.02 240)" />
                    <stop offset="100%" stopColor="oklch(0.4 0.02 240)" />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="oklch(0.3 0.03 250)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="machine" stroke="oklch(0.88 0.02 240)" fontSize={15} fontWeight={600} tickLine={false} axisLine={false} />
                <YAxis type="number" domain={[0, Math.round(capLimitHours)]} tickFormatter={(v) => `${v}h`} stroke="oklch(0.72 0.03 240)" fontSize={13} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: "oklch(0.3 0.03 250 / 0.2)" }}
                  contentStyle={{ background: "oklch(0.22 0.04 250)", border: "1px solid oklch(0.3 0.03 250)", borderRadius: 8, color: "oklch(0.97 0.01 240)", fontSize: 13 }}
                  formatter={(v: number, n) => [`${v.toFixed(1)}h`, n]}
                />
                <Bar dataKey="Urgente" stackId="a" fill="url(#capUrg)" maxBarSize={130} />
                <Bar dataKey="Normal" stackId="a" fill="url(#capNor)" maxBarSize={130} />
                <Bar dataKey="Livre" stackId="a" fill="url(#capLiv)" radius={[10, 10, 0, 0]} maxBarSize={130}>
                  <LabelList
                    dataKey="used"
                    position="top"
                    formatter={(v: number) => `${fmtNum(v, 0)}h`}
                    fill="oklch(0.95 0.01 240)"
                    fontSize={15}
                    fontWeight={700}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {capacityByMachine.map((d) => (
              <div key={d.machine} className="rounded-xl bg-secondary/30 border border-border px-3 py-2 text-center">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{d.machine}</div>
                <div className="text-lg font-bold text-foreground leading-tight">{fmtNum(d.used, 0)}h <span className="text-xs font-normal text-muted-foreground">/ {Math.round(capLimitHours)}h</span></div>
              </div>
            ))}
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
          <div className="overflow-auto max-h-[480px] border-t border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 sticky top-0">
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2">FPP</th>
                  <th className="px-3 py-2">Data Prog. (B)</th>
                  <th className="px-3 py-2">DT Fim Programação (K)</th>
                  <th className="px-3 py-2 text-right">Máquina</th>
                  <th className="px-3 py-2 text-right">Tempo FPP</th>
                  <th className="px-3 py-2 text-right">Atravess. (dias)</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
                <tr className="bg-card/60">
                  <th className="px-2 py-1.5"><input value={fFpp} onChange={(e) => setFFpp(e.target.value)} placeholder="Filtrar…" className="w-full rounded border border-input bg-input/40 px-2 py-1 text-xs" /></th>
                  <th className="px-2 py-1.5" />
                  <th className="px-2 py-1.5" />
                  <th className="px-2 py-1.5">
                    <select value={fMaq} onChange={(e) => setFMaq(e.target.value)} className="w-full rounded border border-input bg-input/40 px-2 py-1 text-xs">
                      <option value="">Todas</option>
                      {MACHINES.map(m => <option key={m} value={String(m)}>{m}</option>)}
                    </select>
                  </th>
                  <th className="px-2 py-1.5" />
                  <th className="px-2 py-1.5" />
                  <th className="px-2 py-1.5">
                    <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="w-full rounded border border-input bg-input/40 px-2 py-1 text-xs">
                      <option value="">Todos</option>
                      <option value="adiantado">Adiantado</option>
                      <option value="ok">Ok</option>
                      <option value="atrasado">Atrasado</option>
                    </select>
                  </th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const filteredDet = atravess.detalhes.filter((d) => {
                    if (fFpp && !(d.fpp ?? "").toLowerCase().includes(fFpp.toLowerCase())) return false;
                    if (fMaq && String(d.maquina ?? "") !== fMaq) return false;
                    if (fStatus) {
                      const st = d.dias > 0 ? "adiantado" : d.dias < 0 ? "atrasado" : "ok";
                      if (st !== fStatus) return false;
                    }
                    return true;
                  });
                  if (filteredDet.length === 0) {
                    return <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Sem dados para avaliação.</td></tr>;
                  }
                  return filteredDet.slice(0, 500).map((d, i) => {
                    const status = d.dias > 0 ? "Adiantado" : d.dias < 0 ? "Atrasado" : "Ok";
                    const cls = d.dias > 0 ? "text-success" : d.dias < 0 ? "text-destructive" : "text-muted-foreground";
                    return (
                      <tr key={i} className="border-t border-border hover:bg-secondary/30">
                        <td className="px-3 py-2 font-mono text-xs">{d.fpp}</td>
                        <td className="px-3 py-2 text-xs">{fmtDate(d.dt_prog)}</td>
                        <td className="px-3 py-2 text-xs">{fmtDate(d.dt_fim_est)}</td>
                        <td className="px-3 py-2 text-right text-xs">{d.maquina ?? "—"}</td>
                        <td className="px-3 py-2 text-right text-xs font-mono">{d.tempo ? fmtHM(d.tempo) : "—"}</td>
                        <td className={`px-3 py-2 text-right font-mono font-semibold ${cls}`}>{d.dias > 0 ? "+" : ""}{d.dias}</td>
                        <td className="px-3 py-2"><span className={`text-xs font-semibold ${cls}`}>{status}</span></td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        )}
      </section>


      <div className="text-xs text-muted-foreground">
        * Capacidade considera o intervalo de datas selecionado (por Data Prog.) e o campo TEMPO FPP da planilha (64h/semana por máquina).
        Urgente = PRODUTO contém "URGENTE". Atravessamento (dias úteis, exclui sábados/domingos, feriados de Curitiba e pontes) = DT FIM PROGRAMAÇÃO (col. K, prazo) − Data Prog. (col. B, entrega real): positivo = adiantado, negativo = atrasado, zero = no prazo (Ok). Meta de atravessamento: {ATRAVESSAMENTO_META_DIAS} dias úteis.
        Sem datas selecionadas, mostra todo o período disponível.
        Punch e Nest ainda usam o mesmo dado até a planilha trazer essa separação.
      </div>



      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-2xl">
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
          {detail?.fppLists?.map((list, idx) => list.fpps.length > 0 && (
            <div key={idx} className="mt-3 rounded-lg border border-primary/30 bg-secondary/40 p-3">
              <div className="text-[11px] uppercase tracking-wider text-foreground font-bold mb-2">
                {list.label} <span className="text-primary">({list.fpps.length})</span>
              </div>
              <div className="max-h-48 overflow-auto flex flex-wrap gap-1.5">
                {list.fpps.map(f => (
                  <span key={f} className="inline-flex items-center rounded-md bg-primary/20 border border-primary/40 text-foreground px-2 py-0.5 text-[11px] font-mono font-semibold">{f}</span>
                ))}
              </div>
            </div>
          ))}
        </DialogContent>
      </Dialog>

      {/* Modal — gráfico expandido capacidade x real */}
      <Dialog open={capModalOpen} onOpenChange={setCapModalOpen}>
        <DialogContent className="max-w-[97vw] w-[97vw] sm:max-w-[97vw] max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <DialogTitle>Planejado × Realizado × Média — por dia</DialogTitle>
                <DialogDescription>
                  Barra azul = Planejado (<strong>DT Planejamento</strong>, col. L). Barra clara = Realizado (dt prog). Linha tracejada = média realizada = {fmtNum(perDay.avg, 1)} FPP/dia útil (realizadas ÷ dias úteis do filtro). Clique numa barra para ver as FPPs.
                </DialogDescription>
                <div className="text-[11px] text-muted-foreground/80 mt-1 italic">
                  Em breve: a classificação de dificuldade dos produtos (1° a 5°) irá ponderar o realizado para explicar dias com menor produção.
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const rows = [["Data", "Planejado", "Realizado", "Diferença", "Média diária"]];
                  perDay.series.forEach(d => {
                    rows.push([d.date, String(d.planejado), String(d.count), String(d.count - d.planejado), perDay.avg.toFixed(2)]);
                  });
                  rows.push([]);
                  rows.push(["Total planejado", String(perDay.series.reduce((s, d) => s + d.planejado, 0))]);
                  rows.push(["Total realizado", String(perDay.series.reduce((s, d) => s + d.count, 0))]);
                  rows.push(["Dias c/ déficit", String(perDay.series.filter(d => d.count < d.planejado).length)]);
                  rows.push(["Dias úteis avaliados", String(perDay.series.length)]);
                  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
                  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `relatorio-planejado-realizado_${new Date().toISOString().slice(0,10)}.csv`;
                  document.body.appendChild(a); a.click(); a.remove();
                  URL.revokeObjectURL(url);
                }}
                className="inline-flex items-center gap-2 rounded-md bg-primary/15 hover:bg-primary/25 border border-primary/40 text-primary text-xs font-semibold px-3 py-2 transition-colors"
              >
                <RefreshCw className="size-3.5" /> Exportar relatório CSV
              </button>
            </div>
          </DialogHeader>
          <div className="h-[calc(95vh-300px)] min-h-[520px]">
            {perDay.series.length === 0 ? (
              <div className="h-full grid place-items-center text-sm text-muted-foreground">Sem dados no período.</div>
            ) : (
              <ResponsiveContainer>
                <BarChart data={perDay.series} margin={{ left: 8, right: 16, top: 28, bottom: 8 }} barGap={6} barCategoryGap="24%">
                  <defs>
                    <linearGradient id="gradPlanejado" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.78 0.16 215)" stopOpacity={1} />
                      <stop offset="100%" stopColor="oklch(0.55 0.15 215)" stopOpacity={1} />
                    </linearGradient>
                    <linearGradient id="gradOk" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.78 0.17 155)" stopOpacity={1} />
                      <stop offset="100%" stopColor="oklch(0.55 0.16 155)" stopOpacity={1} />
                    </linearGradient>
                    <linearGradient id="gradLow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.72 0.22 25)" stopOpacity={1} />
                      <stop offset="100%" stopColor="oklch(0.5 0.2 25)" stopOpacity={1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="oklch(0.3 0.03 250)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" stroke="oklch(0.78 0.03 240)" fontSize={12} tickLine={false} />
                  <YAxis stroke="oklch(0.78 0.03 240)" fontSize={12} allowDecimals={false} width={32} />
                  <Tooltip
                    cursor={{ fill: "oklch(0.3 0.03 250 / 0.25)" }}
                    contentStyle={{ background: "oklch(0.22 0.04 250)", border: "1px solid oklch(0.3 0.03 250)", borderRadius: 8, color: "oklch(0.97 0.01 240)" }}
                    labelFormatter={(l) => `Dia ${l}`}
                    formatter={(v: number, name) => {
                      if (name === "planejado") return [`${v} FPPs`, "Para o dia (planejado · col. L)"];
                      if (name === "count") return [`${v} FPPs`, "Feito no dia"];
                      if (name === "rg") return [`${v}`, "RG planejado"];
                      if (name === "rgReal") return [`${v}`, "RG realizado"];
                      if (name === "media") return [`${fmtNum(v, 1)} FPPs`, "Média do período"];

                      return [`${v}`, name];
                    }}
                  />

                  <Bar dataKey="planejado" radius={[8, 8, 0, 0]} maxBarSize={56} fill="url(#gradPlanejado)"
                    onClick={(d: { label: string; planejado: number; count: number; fppsPlanejado: string[]; fpps: string[] }) => setDetail({
                      title: `Dia ${d.label} — FPPs planejadas`,
                      rows: [
                        { label: "Planejado (DT Planejamento · col. L)", value: fmtInt(d.planejado) },
                        { label: "Realizado (dt prog)", value: fmtInt(d.count) },
                        { label: "Diferença", value: `${d.count - d.planejado >= 0 ? "+" : ""}${d.count - d.planejado}` },
                        { label: "Média diária", value: `${fmtNum(perDay.avg, 1)} FPP/dia` },
                      ],
                      fppLists: [
                        { label: "FPPs planejadas", fpps: d.fppsPlanejado },
                        { label: "FPPs realizadas", fpps: d.fpps },
                      ],
                    })}
                    style={{ cursor: "pointer" }}
                  >
                    <LabelList dataKey="planejado" position="top" fill="oklch(0.9 0.05 215)" fontSize={12} fontWeight={700} />
                  </Bar>
                  <Bar dataKey="count" radius={[8, 8, 0, 0]} maxBarSize={56} fill="rgb(236,235,228)" stroke="oklch(0.4 0.02 250)" strokeWidth={0.5} style={{ cursor: "pointer" }}
                    onClick={(d: { label: string; planejado: number; count: number; fppsPlanejado: string[]; fpps: string[] }) => setDetail({
                      title: `Dia ${d.label} — FPPs realizadas`,
                      rows: [
                        { label: "Planejado (DT Planejamento · col. L)", value: fmtInt(d.planejado) },
                        { label: "Realizado (dt prog)", value: fmtInt(d.count) },
                        { label: "Diferença", value: `${d.count - d.planejado >= 0 ? "+" : ""}${d.count - d.planejado}` },
                        { label: "Média diária", value: `${fmtNum(perDay.avg, 1)} FPP/dia` },
                      ],
                      fppLists: [
                        { label: "FPPs realizadas", fpps: d.fpps },
                        { label: "FPPs planejadas", fpps: d.fppsPlanejado },
                      ],
                    })}
                  >
                    <LabelList dataKey="count" position="top" fill="oklch(0.97 0.01 240)" fontSize={12} fontWeight={800} />
                  </Bar>
                  <Bar dataKey="rg" radius={[8, 8, 0, 0]} maxBarSize={26} fill="oklch(0.78 0.16 75)" style={{ cursor: "pointer" }}
                    onClick={(d: { label: string; rg: number; rgReal: number; rgs: string[] }) => setDetail({
                      title: `Dia ${d.label} — RG planejado`,
                      rows: [
                        { label: "RG planejado", value: fmtInt(d.rg) },
                        { label: "RG realizado", value: fmtInt(d.rgReal) },
                        { label: "Média diária de RG", value: `${fmtNum(perDay.rgAvg, 1)} RG/dia` },
                      ],
                      fppLists: [{ label: "RG", fpps: d.rgs }],
                    })}
                  />
                  <Bar dataKey="rgReal" radius={[8, 8, 0, 0]} maxBarSize={26} fill="oklch(0.7 0.2 330)" style={{ cursor: "pointer" }}
                    onClick={(d: { label: string; rg: number; rgReal: number; rgsReal: string[] }) => setDetail({
                      title: `Dia ${d.label} — RG realizado`,
                      rows: [
                        { label: "RG realizado", value: fmtInt(d.rgReal) },
                        { label: "RG planejado", value: fmtInt(d.rg) },
                      ],
                      fppLists: [{ label: "RG", fpps: d.rgsReal }],
                    })}
                  />
                  <ReferenceLine y={perDay.avg} stroke="oklch(0.82 0.17 75)" strokeDasharray="5 4" strokeWidth={2} label={{ value: `média ${perDay.avg.toFixed(1)}`, fill: "oklch(0.9 0.08 75)", fontSize: 12, position: "right", fontWeight: 700 }} />
                  <ReferenceLine y={perDay.rgAvg} stroke="oklch(0.75 0.16 300)" strokeDasharray="2 5" strokeWidth={2} label={{ value: `média RG ${perDay.rgAvg.toFixed(1)}`, fill: "oklch(0.85 0.12 300)", fontSize: 12, position: "insideTopRight", fontWeight: 700 }} />



                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            {/* FPPs */}
            <div className="rounded-xl border border-border bg-secondary/20 p-3">
              <div className="text-[10px] uppercase tracking-widest font-bold text-foreground mb-2">FPPs</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="rounded-lg bg-secondary/30 border border-border px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total planejado</div>
                  <div className="text-lg font-bold text-foreground">{fmtInt(perDay.series.reduce((s, d) => s + d.planejado, 0))}</div>
                </div>
                <div className="rounded-lg bg-secondary/30 border border-border px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total realizado</div>
                  <div className="text-lg font-bold text-foreground">{fmtInt(perDay.series.reduce((s, d) => s + d.count, 0))}</div>
                </div>
                <div className="rounded-lg bg-secondary/30 border border-border px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Dias c/ déficit</div>
                  <div className="text-lg font-bold text-destructive">{fmtInt(perDay.series.filter(d => d.count < d.planejado).length)}</div>
                </div>
                <div className="rounded-lg bg-secondary/30 border border-border px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Média FPP/dia útil</div>
                  <div className="text-lg font-bold text-foreground">{fmtNum(perDay.avg, 1)}</div>
                </div>
              </div>
            </div>
            {/* RGs */}
            <div className="rounded-xl border border-accent/40 bg-accent/5 p-3">
              <div className="text-[10px] uppercase tracking-widest font-bold text-foreground mb-2">RGs</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="rounded-lg bg-secondary/30 border border-border px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total planejado</div>
                  <div className="text-lg font-bold text-foreground">{fmtInt(perDay.rgTotal)}</div>
                </div>
                <div className="rounded-lg bg-secondary/30 border border-border px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total realizado</div>
                  <div className="text-lg font-bold text-foreground">{fmtInt(perDay.rgRealTotal)}</div>
                </div>
                <div className="rounded-lg bg-secondary/30 border border-border px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Dias c/ déficit</div>
                  <div className="text-lg font-bold text-destructive">{fmtInt(perDay.series.filter(d => (d.rgReal ?? 0) < (d.rg ?? 0)).length)}</div>
                </div>
                <div className="rounded-lg bg-secondary/30 border border-border px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Média RG/dia útil</div>
                  <div className="text-lg font-bold text-foreground">{fmtNum(perDay.rgAvg, 1)}</div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-2 text-center text-[11px] text-muted-foreground">
            Dias úteis no filtro: <span className="text-foreground font-semibold">{fmtInt(perDay.diasUteis)}</span> · médias = realizado ÷ dias úteis do período filtrado
          </div>
        </DialogContent>

      </Dialog>
    </div>
  );
}

const inputCls = "w-full rounded-md border border-input bg-input/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/50";

// Silence eslint: fmtNum used elsewhere
void fmtNum;
