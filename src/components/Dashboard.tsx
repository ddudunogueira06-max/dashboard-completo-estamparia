import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KpiCard } from "@/components/KpiCard";
import { fmtInt, fmtNum, fmtPct, fmtDate } from "@/lib/format";
import { exportToXLSX } from "@/lib/parseExcel";
import {
  detectMaterial, detectThicknessMm, m2ToKg, detailedCategory, filterCategory,
  MATERIAL_LABEL, MATERIAL_SHORT, type MaterialKind,
} from "@/lib/material";
import {
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  ClipboardList, Percent, Trash2, Package, FileText, Download, RefreshCw, Search, CheckCircle2,
} from "lucide-react";

interface WasteRecord {
  id: string;
  tipo: string | null;
  numero: number | null;
  codigo_item: string | null;
  descricao: string | null;
  armazem: string | null;
  fator_perda: number | null;
  linha: number | null;
  qtde_solicitada: number | null;
  data_registro: string | null;
  retalho: number | null;
  status: string | null;
}

const META_PERDA = 15; // meta global (%)

const CHART_COLORS = [
  "oklch(0.72 0.15 215)",
  "oklch(0.7 0.18 45)",
  "oklch(0.7 0.16 155)",
  "oklch(0.78 0.16 75)",
  "oklch(0.65 0.22 305)",
];

const MATERIAL_COLOR: Record<MaterialKind, string> = {
  inox: "oklch(0.72 0.15 215)",
  galvanizado: "oklch(0.78 0.16 75)",
  aluminio: "oklch(0.7 0.16 155)",
  outro: "oklch(0.6 0.02 240)",
};

const MONTH_NAMES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

function EmptyChart() {
  return (
    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
      Sem dados para exibir. Importe uma planilha para visualizar.
    </div>
  );
}

async function fetchAllRecords(): Promise<WasteRecord[]> {
  const pageSize = 1000;
  let from = 0;
  const all: WasteRecord[] = [];
  while (true) {
    const { data, error } = await supabase
      .from("waste_records")
      .select("*")
      .order("data_registro", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as WasteRecord[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

export function Dashboard() {
  const { data: records = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["waste_records"],
    queryFn: fetchAllRecords,
  });

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [tipoFilter, setTipoFilter] = useState<string>("");
  const [materialFilter, setMaterialFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [matrixYear, setMatrixYear] = useState<string>(""); // ano para matriz mensal

  const enriched = useMemo(() => records.map(r => {
    const material = detectMaterial(r.descricao);
    const thickness = detectThicknessMm(r.descricao);
    const det = detailedCategory(r.descricao);
    const fc = filterCategory(r.descricao);
    return {
      ...r,
      material,
      thickness,
      matKey: fc?.key ?? "",
      matLabel: fc?.label ?? MATERIAL_LABEL[material],
      detKey: det?.key ?? "",
      detLabel: det?.label ?? "",
      qtde_kg: m2ToKg(r.qtde_solicitada, r.descricao),
      retalho_kg: m2ToKg(r.retalho ? Math.abs(r.retalho) : 0, r.descricao),
    };
  }), [records]);

  const tipos = useMemo(() => Array.from(new Set(enriched.map(r => r.tipo).filter(Boolean))) as string[], [enriched]);
  const statuses = useMemo(() => Array.from(new Set(enriched.map(r => r.status).filter(Boolean))) as string[], [enriched]);

  const materialThickOptions = useMemo(() => {
    const map = new Map<string, string>();
    enriched.forEach(r => {
      if (r.matKey && !map.has(r.matKey)) map.set(r.matKey, r.matLabel);
    });
    return Array.from(map.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR", { numeric: true }));
  }, [enriched]);

  const filtered = useMemo(() => {
    const s = startDate ? new Date(startDate).getTime() : 0;
    const e = endDate ? new Date(endDate).getTime() + 86400000 : Infinity;
    const q = search.toLowerCase().trim();
    return enriched.filter((r) => {
      const t = r.data_registro ? new Date(r.data_registro).getTime() : 0;
      if (t < s || t > e) return false;
      if (tipoFilter && r.tipo !== tipoFilter) return false;
      if (materialFilter && r.matKey !== materialFilter) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      if (q) {
        const hay = `${r.codigo_item ?? ""} ${r.descricao ?? ""} ${r.numero ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [enriched, startDate, endDate, tipoFilter, materialFilter, statusFilter, search]);

  const metrics = useMemo(() => {
    const totalSolic = filtered.reduce((a, r) => a + r.qtde_kg, 0);
    const totalRetalho = filtered.reduce((a, r) => a + r.retalho_kg, 0);
    const totalDesperd = filtered.reduce((a, r) => a + r.qtde_kg * ((r.fator_perda ?? 0) / 100), 0);
    const totalProcessado = totalSolic - totalDesperd;
    const validPerda = filtered.filter(r => r.fator_perda !== null);
    // média ponderada por kg
    const mediaPerda = totalSolic > 0 ? (totalDesperd / totalSolic) * 100 : 0;
    const itens = new Set(filtered.map(r => r.codigo_item)).size;
    const totalFPP = filtered.filter(r => (r.tipo ?? "").toUpperCase() === "FPP").length;
    const fatorMax = filtered.reduce((a, r) => Math.max(a, r.fator_perda ?? 0), 0);
    const fatorMin = validPerda.length ? validPerda.reduce((a, r) => Math.min(a, r.fator_perda ?? 0), Infinity) : 0;
    return { totalSolic, totalDesperd, totalProcessado, totalRetalho, mediaPerda, itens, totalFPP, fatorMax, fatorMin };
  }, [filtered]);

  // === Matriz mensal — base = TODOS os registros (independe dos filtros do topo)
  const availableYears = useMemo(() => {
    const set = new Set<string>();
    enriched.forEach(r => {
      if (!r.data_registro) return;
      set.add(String(new Date(r.data_registro).getFullYear()));
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [enriched]);

  // ano padrão = mais recente
  const yearSel = matrixYear || availableYears[0] || String(new Date().getFullYear());

  const matrix = useMemo(() => {
    // categorias detalhadas no ano
    const catMap = new Map<string, { label: string; material: MaterialKind }>();
    enriched.forEach(r => {
      if (!r.detKey || !r.data_registro) return;
      const y = String(new Date(r.data_registro).getFullYear());
      if (y !== yearSel) return;
      if (!catMap.has(r.detKey)) catMap.set(r.detKey, { label: r.detLabel, material: r.material });
    });
    // agrega kg solicitado e desperdiçado por categoria/mês
    type Cell = { qtde: number; desp: number };
    const data = new Map<string, Cell[]>();
    catMap.forEach((_v, k) => data.set(k, Array.from({ length: 12 }, () => ({ qtde: 0, desp: 0 }))));
    enriched.forEach(r => {
      if (!r.detKey || !r.data_registro) return;
      const d = new Date(r.data_registro);
      if (String(d.getFullYear()) !== yearSel) return;
      const cell = data.get(r.detKey);
      if (!cell) return;
      const m = d.getMonth();
      cell[m].qtde += r.qtde_kg;
      cell[m].desp += r.qtde_kg * ((r.fator_perda ?? 0) / 100);
    });
    // ordena: inox > galv > alum, por label
    const rows = Array.from(catMap.entries()).map(([key, v]) => ({ key, ...v, cells: data.get(key)! }));
    const order: Record<MaterialKind, number> = { inox: 0, galvanizado: 1, aluminio: 2, outro: 3 };
    rows.sort((a, b) => order[a.material] - order[b.material] || a.label.localeCompare(b.label, "pt-BR", { numeric: true }));
    return rows.map(r => {
      const monthly = r.cells.map(c => (c.qtde > 0 ? +(c.desp / c.qtde * 100).toFixed(2) : null));
      const totalQ = r.cells.reduce((a, c) => a + c.qtde, 0);
      const totalD = r.cells.reduce((a, c) => a + c.desp, 0);
      const acumulada = totalQ > 0 ? +(totalD / totalQ * 100).toFixed(2) : null;
      return { ...r, monthly, acumulada };
    });
  }, [enriched, yearSel]);

  const byTipo = useMemo(() => {
    const agg = new Map<string, number>();
    filtered.forEach(r => {
      const k = r.tipo ?? "—";
      const w = r.qtde_kg * ((r.fator_perda ?? 0) / 100);
      agg.set(k, (agg.get(k) ?? 0) + w);
    });
    return Array.from(agg.entries()).map(([name, value]) => ({ name, value: +value.toFixed(2) }));
  }, [filtered]);

  // Top 10 ponderado pelo VOLUME (kg desperdiçado absoluto)
  // % exibido = média ponderada = totalDespKg / totalQtdeKg
  const topMateriais = useMemo(() => {
    const agg = new Map<string, { qtde: number; desp: number; descricao: string }>();
    filtered.forEach(r => {
      if (!r.codigo_item || r.fator_perda === null || r.qtde_kg <= 0) return;
      const e = agg.get(r.codigo_item) ?? { qtde: 0, desp: 0, descricao: r.descricao ?? "" };
      e.qtde += r.qtde_kg;
      e.desp += r.qtde_kg * ((r.fator_perda ?? 0) / 100);
      if (!e.descricao && r.descricao) e.descricao = r.descricao;
      agg.set(r.codigo_item, e);
    });
    return Array.from(agg.entries())
      .map(([codigo, v]) => ({
        codigo,
        descricao: v.descricao,
        label: v.descricao ? `${codigo} — ${v.descricao}` : codigo,
        desp: +v.desp.toFixed(2),
        media: v.qtde > 0 ? +(v.desp / v.qtde * 100).toFixed(2) : 0,
      }))
      .sort((a, b) => b.desp - a.desp) // ordena por volume absoluto
      .slice(0, 10);
  }, [filtered]);

  const distribuicao = useMemo(() => {
    const buckets = { "0% a 5%": 0, "5% a 10%": 0, "10% a 20%": 0, "Acima de 20%": 0 } as Record<string, number>;
    filtered.forEach(r => {
      const p = r.fator_perda ?? 0;
      if (p <= 5) buckets["0% a 5%"]++;
      else if (p <= 10) buckets["5% a 10%"]++;
      else if (p <= 20) buckets["10% a 20%"]++;
      else buckets["Acima de 20%"]++;
    });
    const total = Object.values(buckets).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(buckets).map(([name, value]) => ({ name, value, pct: +(value * 100 / total).toFixed(1) }));
  }, [filtered]);

  const clearFilters = () => {
    setStartDate(""); setEndDate(""); setTipoFilter(""); setMaterialFilter(""); setStatusFilter(""); setSearch("");
  };

  const handleExport = () => {
    exportToXLSX(filtered.map(r => ({
      Tipo: r.tipo, Número: r.numero, "Código do Item": r.codigo_item, Descrição: r.descricao,
      Material: r.detLabel || MATERIAL_LABEL[r.material], Armazém: r.armazem, "Fator de Perda (%)": r.fator_perda,
      Linha: r.linha, "Qtde. Solicitada (kg)": +r.qtde_kg.toFixed(2),
      "Data de Registro": fmtDate(r.data_registro),
      "Retalho (kg)": +r.retalho_kg.toFixed(2), Status: r.status,
    })), `desperdicios_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Dashboard de Materiais e Desperdícios</h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            {isLoading ? "Carregando…" : `${fmtInt(records.length)} registros · ${fmtInt(filtered.length)} no filtro`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-secondary">
            <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
          <button onClick={handleExport} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            <Download className="size-4" /> <span className="hidden sm:inline">Exportar</span>
          </button>
        </div>
      </header>

      {/* === MOBILE: pílulas grandes e visuais === */}
      <section className="md:hidden grid grid-cols-2 gap-3">
        <BigKpi label="Solicitado" value={fmtNum(metrics.totalSolic)} unit="kg" color="primary" />
        <BigKpi label="Processado" value={fmtNum(metrics.totalProcessado)} unit="kg" color="success" />
        <BigKpi label="Desperdício" value={fmtNum(metrics.totalDesperd)} unit="kg" color="destructive" />
        <BigKpi label="Média" value={fmtPct(metrics.mediaPerda)} unit={`meta ${META_PERDA}%`} color={metrics.mediaPerda > META_PERDA ? "destructive" : "success"} />
        <BigKpi label="Itens" value={fmtInt(metrics.itens)} unit="únicos" color="accent" />
        <BigKpi label="FPPs" value={fmtInt(metrics.totalFPP)} unit="ordens" color="primary" />
      </section>

      {/* === DESKTOP/TV: filtros === */}
      <section className="hidden md:block bg-card border border-border rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
          <Field label="Data inicial">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Data final">
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Tipo">
            <select value={tipoFilter} onChange={(e) => setTipoFilter(e.target.value)} className={inputCls}>
              <option value="">Todos</option>
              {tipos.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Material / Espessura">
            <select value={materialFilter} onChange={(e) => setMaterialFilter(e.target.value)} className={inputCls}>
              <option value="">Todos</option>
              {materialThickOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputCls}>
              <option value="">Todos</option>
              {statuses.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Busca (código, descrição, nº)">
            <div className="relative">
              <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar…" className={`${inputCls} pl-8`} />
            </div>
          </Field>
        </div>
        <div className="mt-3 flex justify-end">
          <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
            Limpar filtros
          </button>
        </div>
      </section>

      {/* KPIs (desktop) */}
      <section className="hidden md:grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Total Solicitado (kg)" value={fmtNum(metrics.totalSolic)} icon={ClipboardList} accent="primary" />
        <KpiCard label="Total Processado (kg)" value={fmtNum(metrics.totalProcessado)} icon={CheckCircle2} accent="success" />
        <KpiCard label="Desperdício Total (kg)" value={fmtNum(metrics.totalDesperd)} icon={Trash2} accent="destructive" />
        <KpiCard label="Média Ponderada (%)" value={fmtPct(metrics.mediaPerda)} icon={Percent} accent="warning" hint={`meta ${META_PERDA}%`} />
        <KpiCard label="Quantidade de Itens" value={fmtInt(metrics.itens)} icon={Package} accent="success" />
        <KpiCard label="Total de FPPs" value={fmtInt(metrics.totalFPP)} icon={FileText} accent="primary" />
      </section>

      {/* === MATRIZ MENSAL POR CATEGORIA (desktop/TV) === */}
      <section className="hidden md:block">
        <Panel
          title={`Média de Desperdício por Material — ${yearSel}`}
          right={
            <select value={yearSel} onChange={(e) => setMatrixYear(e.target.value)} className={`${inputCls} max-w-[120px] py-1 text-xs`}>
              {availableYears.length === 0 && <option>{yearSel}</option>}
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          }
        >
          {matrix.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Sem dados para o ano selecionado.</div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm border-separate border-spacing-0">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="text-left px-3 py-2 bg-secondary/40 rounded-l-md">Indicador</th>
                    <th className="px-2 py-2 bg-secondary/40">Meta<br/>Mensal</th>
                    {MONTH_NAMES.map(m => (
                      <th key={m} className="px-2 py-2 bg-secondary/40">{m}</th>
                    ))}
                    <th className="px-2 py-2 bg-secondary/40 rounded-r-md">Média<br/>Acumulada</th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.map(row => (
                    <tr key={row.key} className="border-t border-border">
                      <td className="px-3 py-2.5 font-semibold whitespace-nowrap">
                        <span
                          className="inline-block size-2.5 rounded-full mr-2 align-middle"
                          style={{ background: MATERIAL_COLOR[row.material] }}
                        />
                        {row.label}
                      </td>
                      <td className="px-2 py-2.5 text-center text-muted-foreground font-medium">{META_PERDA.toFixed(2)}%</td>
                      {row.monthly.map((v, i) => (
                        <td key={i} className="px-2 py-2.5 text-center font-mono">
                          {v === null ? <span className="text-muted-foreground/50">—</span> : (
                            <span className={v > META_PERDA ? "text-destructive font-semibold" : "text-success font-medium"}>
                              {fmtPct(v)}
                            </span>
                          )}
                        </td>
                      ))}
                      <td className="px-2 py-2.5 text-center font-mono font-bold">
                        {row.acumulada === null ? "—" : (
                          <span className={row.acumulada > META_PERDA ? "text-destructive" : "text-success"}>
                            {fmtPct(row.acumulada)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 flex items-center gap-4 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-success" /> abaixo da meta</span>
                <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-destructive" /> acima da meta ({META_PERDA}%)</span>
              </div>
            </div>
          )}
        </Panel>
      </section>

      {/* Charts row (desktop) */}
      <section className="hidden md:grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="Top 10 — Maior volume de desperdício (kg)" className="lg:col-span-2">
          <div className="h-[420px]">
            {topMateriais.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer>
              <BarChart data={topMateriais} layout="vertical" margin={{ left: 8, right: 32 }}>
                <CartesianGrid stroke="oklch(0.3 0.03 250)" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" stroke="oklch(0.72 0.03 240)" fontSize={11} tickFormatter={(v) => `${fmtNum(v, 0)}`} />
                <YAxis type="category" dataKey="label" stroke="oklch(0.72 0.03 240)" fontSize={10} width={300} interval={0} tick={{ fill: "oklch(0.85 0.02 240)" }} />
                <Tooltip
                  contentStyle={{ background: "oklch(0.22 0.04 250)", border: "1px solid oklch(0.3 0.03 250)", borderRadius: 8, color: "oklch(0.97 0.01 240)" }}
                  formatter={(_v: number, _n, item) => {
                    const p = item?.payload as { desp: number; media: number };
                    return [`${fmtNum(p.desp)} kg · ${fmtPct(p.media)} médio`, "Desperdício"];
                  }}
                  labelFormatter={(l) => String(l)}
                />
                <Bar dataKey="desp" fill={CHART_COLORS[1]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            )}
          </div>
        </Panel>

        <Panel title="Desperdício por Tipo (kg)">
          <div className="h-[420px]">
            {byTipo.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer>
              <PieChart>
                <Pie data={byTipo} dataKey="value" nameKey="name" innerRadius={60} outerRadius={110} paddingAngle={2}>
                  {byTipo.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 12, color: "oklch(0.92 0.01 240)" }} />
                <Tooltip
                  contentStyle={{ background: "oklch(0.22 0.04 250)", border: "1px solid oklch(0.3 0.03 250)", borderRadius: 8, color: "oklch(0.97 0.01 240)" }}
                  formatter={(v: number) => `${fmtNum(v)} kg`}
                />
              </PieChart>
            </ResponsiveContainer>
            )}
          </div>
        </Panel>
      </section>

      {/* Distribuição (desktop) */}
      <section className="hidden md:grid grid-cols-1 gap-4">
        <Panel title="Distribuição do Fator de Perda">
          <div className="h-72">
            {filtered.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer>
              <PieChart>
                <Pie data={distribuicao} dataKey="value" nameKey="name" outerRadius={90} label={(d) => `${d.pct}%`} labelLine={false}>
                  {distribuicao.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 12, color: "oklch(0.92 0.01 240)" }} />
                <Tooltip contentStyle={{ background: "oklch(0.22 0.04 250)", border: "1px solid oklch(0.3 0.03 250)", borderRadius: 8, color: "oklch(0.97 0.01 240)" }} />
              </PieChart>
            </ResponsiveContainer>
            )}
          </div>
        </Panel>
      </section>

      {/* === MOBILE: top 5 visual === */}
      <section className="md:hidden">
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-3">Top 5 Maior Desperdício</h3>
          {topMateriais.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sem dados.</p>
          ) : (
            <ul className="space-y-3">
              {topMateriais.slice(0, 5).map(m => {
                const max = topMateriais[0].desp || 1;
                const pct = (m.desp / max) * 100;
                return (
                  <li key={m.codigo} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-mono truncate max-w-[60%]">{m.codigo}</span>
                      <span className="text-destructive font-semibold">{fmtNum(m.desp)} kg</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-destructive rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">{m.descricao} · {fmtPct(m.media)}</div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Detail table (desktop only) */}
      <section className="hidden md:block bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
            Detalhamento das Solicitações
          </h3>
          <span className="text-xs text-muted-foreground">{fmtInt(filtered.length)} linhas</span>
        </div>
        <div className="overflow-auto max-h-[480px]">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 sticky top-0">
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                {["Tipo", "Nº", "Código", "Descrição", "Categoria", "Fator %", "Linha", "Qtde (kg)", "Data", "Retalho (kg)", "Status"].map(h => (
                  <th key={h} className="px-3 py-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 500).map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-secondary/30">
                  <td className="px-3 py-2"><span className="inline-flex items-center rounded-md bg-primary/15 text-primary px-2 py-0.5 text-xs font-medium">{r.tipo}</span></td>
                  <td className="px-3 py-2 text-muted-foreground">{r.numero}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.codigo_item}</td>
                  <td className="px-3 py-2 max-w-[260px] truncate">{r.descricao}</td>
                  <td className="px-3 py-2"><span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium" style={{ background: `color-mix(in oklab, ${MATERIAL_COLOR[r.material]} 18%, transparent)`, color: MATERIAL_COLOR[r.material] }}>{r.detLabel || MATERIAL_LABEL[r.material]}</span></td>
                  <td className="px-3 py-2 font-medium">{r.fator_perda !== null ? `${fmtNum(r.fator_perda, 0)}%` : "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.linha}</td>
                  <td className="px-3 py-2">{r.qtde_kg > 0 ? fmtNum(r.qtde_kg) : "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">{fmtDate(r.data_registro)}</td>
                  <td className="px-3 py-2">{r.retalho_kg > 0 ? fmtNum(r.retalho_kg) : "—"}</td>
                  <td className="px-3 py-2"><span className="text-xs text-success">{r.status}</span></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={11} className="px-3 py-10 text-center text-muted-foreground">Nenhum registro. Importe uma planilha na aba "Importar Planilha".</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 500 && (
          <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border bg-secondary/20">
            Exibindo as primeiras 500 linhas. Use os filtros ou exporte para ver todas.
          </div>
        )}
      </section>
    </div>
  );
}

const inputCls = "w-full rounded-md border border-input bg-input/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/50";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Panel({ title, children, className = "", right }: { title: string; children: React.ReactNode; className?: string; right?: React.ReactNode }) {
  return (
    <div className={`bg-card border border-border rounded-xl p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3 gap-2">
        <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

function BigKpi({ label, value, unit, color }: { label: string; value: string; unit: string; color: "primary" | "success" | "destructive" | "accent" }) {
  const map = {
    primary: "from-primary/25 to-primary/5 text-primary",
    success: "from-success/25 to-success/5 text-success",
    destructive: "from-destructive/25 to-destructive/5 text-destructive",
    accent: "from-accent/25 to-accent/5 text-accent",
  };
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br ${map[color]} p-4`}>
      <div className="text-[10px] uppercase tracking-wider font-semibold opacity-80">{label}</div>
      <div className="mt-1 text-2xl font-extrabold text-foreground leading-tight">{value}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{unit}</div>
    </div>
  );
}
