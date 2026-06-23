import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KpiCard } from "@/components/KpiCard";
import { fmtInt, fmtNum, fmtDate } from "@/lib/format";
import {
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, LabelList, Legend, Cell,
} from "recharts";
import { Factory, Clock, RefreshCw, AlertOctagon, TrendingDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface OeeDia {
  id: string; turno: number; maquina: number; data: string;
  horas_disp_seg: number | null; horas_prog_seg: number | null; horas_reg_seg: number | null;
  paradas_prog_seg: number | null; paradas_nao_prog_seg: number | null; oee: number | null;
}
interface OeeParada {
  id: string; turno: number; maquina: number; mes_ref: string;
  categoria: string; total_seg: number;
}

const MACHINES = [2000, 3000, 5000] as const;
// 15:54 = 15*3600 + 54*60 = 57240 s
const CAPACIDADE_DIA_SEG = 15 * 3600 + 54 * 60;

const inputCls = "w-full rounded-md border border-input bg-input/40 px-3 py-2 text-sm";

function fmtHM(seg: number): string {
  if (!Number.isFinite(seg) || seg < 0) return "0h";
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function isRefeicao(cat: string) {
  return /refei[çc][ãa]o/i.test(cat);
}

async function fetchOeeDias(): Promise<OeeDia[]> {
  const { data, error } = await supabase.from("oee_dias").select("*").order("data", { ascending: true });
  if (error) throw error;
  return (data ?? []) as OeeDia[];
}
async function fetchOeeParadas(): Promise<OeeParada[]> {
  const { data, error } = await supabase.from("oee_paradas").select("*");
  if (error) throw error;
  return (data ?? []) as OeeParada[];
}

function inRange(date: string, from: string, to: string) {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

export function OeeDashboard() {
  const { data: dias = [], isLoading: l1, refetch: r1, isFetching: f1 } =
    useQuery({ queryKey: ["oee_dias"], queryFn: fetchOeeDias });
  const { data: paradas = [], isLoading: l2, refetch: r2, isFetching: f2 } =
    useQuery({ queryKey: ["oee_paradas"], queryFn: fetchOeeParadas });

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [maqFilter, setMaqFilter] = useState("");
  const [turnoFilter, setTurnoFilter] = useState("");

  const [paradasModal, setParadasModal] = useState(false);
  const [paradaDetail, setParadaDetail] = useState<null | { titulo: string; itens: { categoria: string; seg: number }[] }>(null);

  const isLoading = l1 || l2;

  // Filtered subsets
  const diasFlt = useMemo(() => dias.filter(d => {
    if (!inRange(d.data, dateFrom, dateTo)) return false;
    if (maqFilter && String(d.maquina) !== maqFilter) return false;
    if (turnoFilter && String(d.turno) !== turnoFilter) return false;
    return true;
  }), [dias, dateFrom, dateTo, maqFilter, turnoFilter]);

  // For paradas filter: mes_ref must intersect range; here we filter by month containment
  const paradasFlt = useMemo(() => paradas.filter(p => {
    // mes_ref is first day of month. We include if month overlaps the range loosely.
    if (dateFrom) {
      const fromYM = dateFrom.slice(0, 7);
      if (p.mes_ref.slice(0, 7) < fromYM) return false;
    }
    if (dateTo) {
      const toYM = dateTo.slice(0, 7);
      if (p.mes_ref.slice(0, 7) > toYM) return false;
    }
    if (maqFilter && String(p.maquina) !== maqFilter) return false;
    if (turnoFilter && String(p.turno) !== turnoFilter) return false;
    return true;
  }), [paradas, dateFrom, dateTo, maqFilter, turnoFilter]);

  const rangeLabel = useMemo(() => {
    if (dateFrom && dateTo) return `${fmtDate(dateFrom)} – ${fmtDate(dateTo)}`;
    if (dateFrom) return `desde ${fmtDate(dateFrom)}`;
    if (dateTo) return `até ${fmtDate(dateTo)}`;
    return "todo o período";
  }, [dateFrom, dateTo]);

  // Refeição diária por (turno, maquina, mes) — distribuída proporcionalmente entre os dias do mês
  // Mapa (turno|maquina|YYYY-MM) -> refeicao_seg_mes
  const refeicaoPorMes = useMemo(() => {
    const m = new Map<string, number>();
    paradas.forEach(p => {
      if (!isRefeicao(p.categoria)) return;
      const k = `${p.turno}|${p.maquina}|${p.mes_ref.slice(0, 7)}`;
      m.set(k, (m.get(k) ?? 0) + p.total_seg);
    });
    return m;
  }, [paradas]);

  const diasPorMesGroup = useMemo(() => {
    // count dias por (turno|maquina|YYYY-MM) considering ALL dias in DB (não filtrados)
    const m = new Map<string, number>();
    dias.forEach(d => {
      const k = `${d.turno}|${d.maquina}|${d.data.slice(0, 7)}`;
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return m;
  }, [dias]);

  // Capacidade real por máquina no período = sum_dias(15h54 - (paradas_dia - refeicao_dia))
  // paradas_dia = horas_paradas_prog + horas_paradas_nao_prog (PDF)
  // refeicao_dia = refeicao_mes / nº dias daquele mes/turno/maquina
  const capByMachine = useMemo(() => {
    const list = maqFilter ? [Number(maqFilter)] : [...MACHINES];
    return list.map(m => {
      let cap = 0, livre = 0, paradasSeg = 0, refSeg = 0, regSeg = 0;
      diasFlt.filter(d => d.maquina === m).forEach(d => {
        const par = (d.paradas_prog_seg ?? 0) + (d.paradas_nao_prog_seg ?? 0);
        const ym = d.data.slice(0, 7);
        const k = `${d.turno}|${d.maquina}|${ym}`;
        const refMes = refeicaoPorMes.get(k) ?? 0;
        const diasMes = diasPorMesGroup.get(k) ?? 1;
        const refDia = refMes / diasMes;
        const paradaSemRef = Math.max(0, par - refDia);
        const capDia = Math.max(0, CAPACIDADE_DIA_SEG - paradaSemRef);
        const reg = d.horas_reg_seg ?? 0;
        cap += capDia;
        regSeg += reg;
        livre += Math.max(0, capDia - reg);
        paradasSeg += par;
        refSeg += refDia;
      });
      return {
        machine: m, capSeg: cap, livreSeg: livre, regSeg, paradasSeg, refSeg,
        // for chart "Máq XXXX  Yh / Zh" — Y = livre, Z = capacidade
      };
    });
  }, [diasFlt, maqFilter, refeicaoPorMes, diasPorMesGroup]);

  // Pílula de Paradas (total, excluindo refeição) — soma sobre paradasFlt
  const paradasResumo = useMemo(() => {
    let total = 0;
    const byCat = new Map<string, number>();
    paradasFlt.forEach(p => {
      if (isRefeicao(p.categoria)) return;
      total += p.total_seg;
      byCat.set(p.categoria, (byCat.get(p.categoria) ?? 0) + p.total_seg);
    });
    const lista = Array.from(byCat.entries())
      .map(([categoria, seg]) => ({ categoria, seg }))
      .sort((a, b) => b.seg - a.seg);
    return { totalSeg: total, lista };
  }, [paradasFlt]);

  // Gráfico: nº de categorias de parada distintas por máquina e turno
  const paradasGrafico = useMemo(() => {
    type Row = { machine: string; "Turno 1": number; "Turno 2": number };
    return MACHINES.map(m => {
      const t1 = new Set<string>();
      const t2 = new Set<string>();
      paradasFlt.forEach(p => {
        if (p.maquina !== m) return;
        if (isRefeicao(p.categoria)) return;
        if (p.total_seg <= 0) return;
        if (p.turno === 1) t1.add(p.categoria);
        else if (p.turno === 2) t2.add(p.categoria);
      });
      return { machine: `Máq ${m}`, maqNum: m, "Turno 1": t1.size, "Turno 2": t2.size } as Row & { maqNum: number };
    });
  }, [paradasFlt]);

  const openParadaDetail = (m: number, turno: 1 | 2) => {
    const itens = paradasFlt
      .filter(p => p.maquina === m && p.turno === turno && !isRefeicao(p.categoria))
      .reduce((acc, p) => {
        const cur = acc.get(p.categoria) ?? 0;
        acc.set(p.categoria, cur + p.total_seg);
        return acc;
      }, new Map<string, number>());
    setParadaDetail({
      titulo: `Paradas — Máq ${m} · Turno ${turno}º · ${rangeLabel}`,
      itens: Array.from(itens.entries()).map(([categoria, seg]) => ({ categoria, seg })).sort((a, b) => b.seg - a.seg),
    });
  };

  const refetchAll = () => { r1(); r2(); };

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">OEE & Capacidade Real</h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            {isLoading ? "Carregando…" : `${fmtInt(dias.length)} dias · ${fmtInt(paradas.length)} paradas importadas`}
          </p>
        </div>
        <button onClick={refetchAll} className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-secondary">
          <RefreshCw className={`size-4 ${(f1 || f2) ? "animate-spin" : ""}`} />
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
            <select value={maqFilter} onChange={(e) => setMaqFilter(e.target.value)} className={inputCls}>
              <option value="">Todas as máquinas</option>
              {MACHINES.map(m => <option key={m} value={String(m)}>Máquina {m}</option>)}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Turno</span>
            <select value={turnoFilter} onChange={(e) => setTurnoFilter(e.target.value)} className={inputCls}>
              <option value="">Todos os turnos</option>
              <option value="1">1º Turno</option>
              <option value="2">2º Turno</option>
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

      {/* Pílulas de máquinas — horas livres / capacidade real */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {capByMachine.map(c => (
          <div key={c.machine} className="bg-card border border-border rounded-xl p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground text-center">Máq {c.machine}</div>
            <div className="text-3xl font-extrabold text-foreground text-center mt-1">
              {fmtNum(c.livreSeg / 3600, 0)}h
              <span className="text-base font-normal text-muted-foreground ml-1">/ {fmtNum(c.capSeg / 3600, 0)}h</span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1 text-[10px] text-center text-muted-foreground">
              <div><span className="block font-semibold text-foreground">{fmtHM(c.regSeg)}</span>registrado</div>
              <div><span className="block font-semibold text-foreground">{fmtHM(c.paradasSeg)}</span>parado</div>
              <div><span className="block font-semibold text-foreground">{fmtHM(c.refSeg)}</span>refeição</div>
            </div>
          </div>
        ))}
      </section>

      {/* Pílula de paradas */}
      <section>
        <button type="button" onClick={() => setParadasModal(true)}
          className="w-full bg-gradient-to-br from-destructive/20 to-destructive/5 border border-destructive/40 rounded-xl p-4 flex items-center gap-4 hover:border-destructive/60 transition-colors text-left">
          <div className="size-14 rounded-xl grid place-items-center bg-destructive/20 text-destructive shrink-0">
            <AlertOctagon className="size-7" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Tempo total de paradas (sem refeição)</div>
            <div className="text-3xl font-extrabold leading-tight text-destructive">{fmtHM(paradasResumo.totalSeg)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{rangeLabel} · {fmtInt(paradasResumo.lista.length)} categorias · clique para detalhes</div>
          </div>
          <TrendingDown className="size-6 text-destructive/70" />
        </button>
      </section>

      {/* Gráfico paradas por máquina/turno */}
      <section className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <h3 className="font-bold text-base uppercase tracking-wider text-foreground inline-flex items-center gap-2">
            <Factory className="size-5 text-primary" /> Paradas por máquina e turno
          </h3>
          <div className="flex items-center gap-4 text-xs">
            <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-sm" style={{ background: "oklch(0.72 0.15 215)" }} /> 1º Turno</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-sm" style={{ background: "oklch(0.68 0.18 320)" }} /> 2º Turno</span>
            <span className="text-muted-foreground">clique numa barra para detalhar</span>
          </div>
        </div>
        <div className="h-[340px]">
          <ResponsiveContainer>
            <BarChart data={paradasGrafico} margin={{ left: 8, right: 16, top: 24, bottom: 8 }}>
              <CartesianGrid stroke="oklch(0.3 0.03 250)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="machine" stroke="oklch(0.88 0.02 240)" fontSize={14} fontWeight={600} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} stroke="oklch(0.72 0.03 240)" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ fill: "oklch(0.3 0.03 250 / 0.2)" }}
                contentStyle={{ background: "oklch(0.22 0.04 250)", border: "1px solid oklch(0.3 0.03 250)", borderRadius: 8, color: "oklch(0.97 0.01 240)", fontSize: 13 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Turno 1" fill="oklch(0.72 0.15 215)" radius={[6, 6, 0, 0]} maxBarSize={60}
                onClick={(d) => openParadaDetail((d as unknown as { maqNum: number }).maqNum, 1)}
                style={{ cursor: "pointer" }}>
                <LabelList dataKey="Turno 1" position="top" fill="oklch(0.95 0.01 240)" fontSize={12} fontWeight={700} />
              </Bar>
              <Bar dataKey="Turno 2" fill="oklch(0.68 0.18 320)" radius={[6, 6, 0, 0]} maxBarSize={60}
                onClick={(d) => openParadaDetail((d as unknown as { maqNum: number }).maqNum, 2)}
                style={{ cursor: "pointer" }}>
                <LabelList dataKey="Turno 2" position="top" fill="oklch(0.95 0.01 240)" fontSize={12} fontWeight={700} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Modal: paradas detalhadas (pílula) */}
      <Dialog open={paradasModal} onOpenChange={setParadasModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhe das paradas — {rangeLabel}</DialogTitle>
            <DialogDescription>Total: {fmtHM(paradasResumo.totalSeg)} (refeição não incluída)</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 sticky top-0">
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2">Categoria</th>
                  <th className="px-3 py-2 text-right">Horas</th>
                  <th className="px-3 py-2 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {paradasResumo.lista.map((it, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-2">{it.categoria}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmtHM(it.seg)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{paradasResumo.totalSeg > 0 ? `${(it.seg / paradasResumo.totalSeg * 100).toFixed(1)}%` : "—"}</td>
                  </tr>
                ))}
                {paradasResumo.lista.length === 0 && (
                  <tr><td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">Sem paradas no período.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: paradas por máquina/turno (clique no gráfico) */}
      <Dialog open={!!paradaDetail} onOpenChange={(open) => !open && setParadaDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{paradaDetail?.titulo}</DialogTitle>
            <DialogDescription>{paradaDetail ? `${fmtInt(paradaDetail.itens.length)} categorias` : ""}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 sticky top-0">
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2">Categoria</th>
                  <th className="px-3 py-2 text-right">Horas</th>
                </tr>
              </thead>
              <tbody>
                {paradaDetail?.itens.map((it, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-2">{it.categoria}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmtHM(it.seg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
