import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KpiCard } from "@/components/KpiCard";
import { fmtInt, fmtNum, fmtPct, fmtDate, fmtShortDate } from "@/lib/format";
import { exportToXLSX } from "@/lib/parseExcel";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  ClipboardList, Percent, Trash2, Package, FileText, Download, RefreshCw, Search,
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

const CHART_COLORS = [
  "oklch(0.72 0.15 215)",
  "oklch(0.7 0.18 45)",
  "oklch(0.7 0.16 155)",
  "oklch(0.78 0.16 75)",
  "oklch(0.65 0.22 305)",
];

async function fetchAllRecords(): Promise<WasteRecord[]> {
  const pageSize = 1000;
  let from = 0;
  const all: WasteRecord[] = [];
  // paginated read to bypass 1000-row default
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
  const [armazemFilter, setArmazemFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState("");

  const tipos = useMemo(() => Array.from(new Set(records.map(r => r.tipo).filter(Boolean))) as string[], [records]);
  const armazens = useMemo(() => Array.from(new Set(records.map(r => r.armazem).filter(Boolean))) as string[], [records]);
  const statuses = useMemo(() => Array.from(new Set(records.map(r => r.status).filter(Boolean))) as string[], [records]);

  const filtered = useMemo(() => {
    const s = startDate ? new Date(startDate).getTime() : 0;
    const e = endDate ? new Date(endDate).getTime() + 86400000 : Infinity;
    const q = search.toLowerCase().trim();
    return records.filter((r) => {
      const t = r.data_registro ? new Date(r.data_registro).getTime() : 0;
      if (t < s || t > e) return false;
      if (tipoFilter && r.tipo !== tipoFilter) return false;
      if (armazemFilter && r.armazem !== armazemFilter) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      if (q) {
        const hay = `${r.codigo_item ?? ""} ${r.descricao ?? ""} ${r.numero ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [records, startDate, endDate, tipoFilter, armazemFilter, statusFilter, search]);

  const metrics = useMemo(() => {
    const totalSolic = filtered.reduce((a, r) => a + (r.qtde_solicitada ?? 0), 0);
    const totalRetalho = filtered.reduce((a, r) => a + Math.abs(r.retalho ?? 0), 0);
    const totalDesperd = filtered.reduce((a, r) => a + (r.qtde_solicitada ?? 0) * ((r.fator_perda ?? 0) / 100), 0);
    const validPerda = filtered.filter(r => r.fator_perda !== null);
    const mediaPerda = validPerda.length ? validPerda.reduce((a, r) => a + (r.fator_perda ?? 0), 0) / validPerda.length : 0;
    const itens = new Set(filtered.map(r => r.codigo_item)).size;
    const solicitacoes = new Set(filtered.map(r => r.numero)).size;
    const fatorMax = filtered.reduce((a, r) => Math.max(a, r.fator_perda ?? 0), 0);
    const fatorMin = validPerda.length ? validPerda.reduce((a, r) => Math.min(a, r.fator_perda ?? 0), Infinity) : 0;

    // Material mais desperdiçado
    const matAgg = new Map<string, number>();
    filtered.forEach(r => {
      if (!r.codigo_item) return;
      const w = (r.qtde_solicitada ?? 0) * ((r.fator_perda ?? 0) / 100);
      matAgg.set(r.codigo_item, (matAgg.get(r.codigo_item) ?? 0) + w);
    });
    const topMat = Array.from(matAgg.entries()).sort((a, b) => b[1] - a[1])[0];

    // Setor (armazém) com mais desperdício
    const setorAgg = new Map<string, number>();
    filtered.forEach(r => {
      if (!r.armazem) return;
      const w = (r.qtde_solicitada ?? 0) * ((r.fator_perda ?? 0) / 100);
      setorAgg.set(r.armazem, (setorAgg.get(r.armazem) ?? 0) + w);
    });
    const topSetor = Array.from(setorAgg.entries()).sort((a, b) => b[1] - a[1])[0];

    return { totalSolic, totalDesperd, totalRetalho, mediaPerda, itens, solicitacoes, fatorMax, fatorMin, topMat, topSetor };
  }, [filtered]);

  // Time series: média de perda por dia
  const timeSeries = useMemo(() => {
    const byDay = new Map<string, { sum: number; n: number; t: number }>();
    filtered.forEach(r => {
      if (!r.data_registro || r.fator_perda === null) return;
      const d = new Date(r.data_registro);
      const key = d.toISOString().slice(0, 10);
      const e = byDay.get(key) ?? { sum: 0, n: 0, t: d.getTime() };
      e.sum += r.fator_perda ?? 0;
      e.n += 1;
      byDay.set(key, e);
    });
    return Array.from(byDay.entries())
      .sort((a, b) => a[1].t - b[1].t)
      .map(([k, v]) => ({ date: fmtShortDate(k), media: +(v.sum / v.n).toFixed(2) }));
  }, [filtered]);

  // Desperdício por tipo (pie)
  const byTipo = useMemo(() => {
    const agg = new Map<string, number>();
    filtered.forEach(r => {
      const k = r.tipo ?? "—";
      const w = (r.qtde_solicitada ?? 0) * ((r.fator_perda ?? 0) / 100);
      agg.set(k, (agg.get(k) ?? 0) + w);
    });
    return Array.from(agg.entries()).map(([name, value]) => ({ name, value: +value.toFixed(2) }));
  }, [filtered]);

  // Top 10 materiais
  const topMateriais = useMemo(() => {
    const agg = new Map<string, { sum: number; n: number }>();
    filtered.forEach(r => {
      if (!r.codigo_item || r.fator_perda === null) return;
      const e = agg.get(r.codigo_item) ?? { sum: 0, n: 0 };
      e.sum += r.fator_perda ?? 0;
      e.n += 1;
      agg.set(r.codigo_item, e);
    });
    return Array.from(agg.entries())
      .map(([codigo, v]) => ({ codigo, media: +(v.sum / v.n).toFixed(2) }))
      .sort((a, b) => b.media - a.media)
      .slice(0, 10);
  }, [filtered]);

  // Distribuição faixas de perda
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

  // Setores
  const bySetor = useMemo(() => {
    const agg = new Map<string, number>();
    filtered.forEach(r => {
      const k = r.armazem ?? "—";
      const w = (r.qtde_solicitada ?? 0) * ((r.fator_perda ?? 0) / 100);
      agg.set(k, (agg.get(k) ?? 0) + w);
    });
    return Array.from(agg.entries()).map(([name, value]) => ({ name, value: +value.toFixed(2) })).sort((a, b) => b.value - a.value);
  }, [filtered]);

  const clearFilters = () => {
    setStartDate(""); setEndDate(""); setTipoFilter(""); setArmazemFilter(""); setStatusFilter(""); setSearch("");
  };

  const handleExport = () => {
    exportToXLSX(filtered.map(r => ({
      Tipo: r.tipo, Número: r.numero, "Código do Item": r.codigo_item, Descrição: r.descricao,
      Armazém: r.armazem, "Fator de Perda (%)": r.fator_perda, Linha: r.linha,
      "Qtde. Solicitada (m²)": r.qtde_solicitada, "Data de Registro": fmtDate(r.data_registro),
      "Retalho (m²)": r.retalho, Status: r.status,
    })), `desperdicios_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard de Materiais e Desperdícios</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Carregando…" : `${fmtInt(records.length)} registros no banco · ${fmtInt(filtered.length)} no filtro atual`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-secondary"
          >
            <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </button>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Download className="size-4" /> Exportar Excel
          </button>
        </div>
      </header>

      {/* Filtros */}
      <section className="bg-card border border-border rounded-xl p-4">
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
          <Field label="Setor (Armazém)">
            <select value={armazemFilter} onChange={(e) => setArmazemFilter(e.target.value)} className={inputCls}>
              <option value="">Todos</option>
              {armazens.map(t => <option key={t} value={t}>{t}</option>)}
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

      {/* KPIs */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Total Solicitado (m²)" value={fmtNum(metrics.totalSolic)} icon={ClipboardList} accent="primary" />
        <KpiCard label="Média de Desperdício" value={fmtPct(metrics.mediaPerda)} icon={Percent} accent="warning" />
        <KpiCard label="Desperdício Total (m²)" value={fmtNum(metrics.totalDesperd)} icon={Trash2} accent="destructive" />
        <KpiCard label="Quantidade de Itens" value={fmtInt(metrics.itens)} icon={Package} accent="success" />
        <KpiCard label="Total de Solicitações" value={fmtInt(metrics.solicitacoes)} icon={FileText} accent="primary" />
        <KpiCard
          label="Setor c/ maior desp."
          value={metrics.topSetor?.[0] ?? "—"}
          hint={metrics.topSetor ? `${fmtNum(metrics.topSetor[1])} m²` : ""}
          icon={Package}
          accent="accent"
        />
      </section>

      {/* Charts row 1 */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="Média de Desperdício (%) ao longo do tempo" className="lg:col-span-2">
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={timeSeries}>
                <CartesianGrid stroke="oklch(0.3 0.03 250)" strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke="oklch(0.72 0.03 240)" fontSize={11} />
                <YAxis stroke="oklch(0.72 0.03 240)" fontSize={11} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  contentStyle={{ background: "oklch(0.22 0.04 250)", border: "1px solid oklch(0.3 0.03 250)", borderRadius: 8, color: "oklch(0.97 0.01 240)" }}
                  formatter={(v: number) => [`${v}%`, "Média"]}
                />
                <Line type="monotone" dataKey="media" stroke={CHART_COLORS[0]} strokeWidth={2.5} dot={{ r: 3, fill: CHART_COLORS[0] }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Desperdício por Tipo">
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={byTipo} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                  {byTipo.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 12, color: "oklch(0.92 0.01 240)" }} />
                <Tooltip
                  contentStyle={{ background: "oklch(0.22 0.04 250)", border: "1px solid oklch(0.3 0.03 250)", borderRadius: 8, color: "oklch(0.97 0.01 240)" }}
                  formatter={(v: number) => `${fmtNum(v)} m²`}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </section>

      {/* Charts row 2 */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="Top 10 Materiais — Maior índice de desperdício (%)" className="lg:col-span-2">
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={topMateriais} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid stroke="oklch(0.3 0.03 250)" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" stroke="oklch(0.72 0.03 240)" fontSize={11} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="codigo" stroke="oklch(0.72 0.03 240)" fontSize={11} width={130} />
                <Tooltip
                  contentStyle={{ background: "oklch(0.22 0.04 250)", border: "1px solid oklch(0.3 0.03 250)", borderRadius: 8, color: "oklch(0.97 0.01 240)" }}
                  formatter={(v: number) => [`${v}%`, "Média"]}
                />
                <Bar dataKey="media" fill={CHART_COLORS[1]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Distribuição do Fator de Perda">
          <div className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={distribuicao} dataKey="value" nameKey="name" outerRadius={90} label={(d) => `${d.pct}%`} labelLine={false}>
                  {distribuicao.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 12, color: "oklch(0.92 0.01 240)" }} />
                <Tooltip
                  contentStyle={{ background: "oklch(0.22 0.04 250)", border: "1px solid oklch(0.3 0.03 250)", borderRadius: 8, color: "oklch(0.97 0.01 240)" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </section>

      {/* Charts row 3 */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Desperdício por Setor (Armazém)">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={bySetor}>
                <CartesianGrid stroke="oklch(0.3 0.03 250)" strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke="oklch(0.72 0.03 240)" fontSize={11} />
                <YAxis stroke="oklch(0.72 0.03 240)" fontSize={11} />
                <Tooltip
                  contentStyle={{ background: "oklch(0.22 0.04 250)", border: "1px solid oklch(0.3 0.03 250)", borderRadius: 8, color: "oklch(0.97 0.01 240)" }}
                  formatter={(v: number) => `${fmtNum(v)} m²`}
                />
                <Bar dataKey="value" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Resumo do período">
          <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
            <SummaryRow label="Total Solicitado (m²)" value={fmtNum(metrics.totalSolic)} />
            <SummaryRow label="Desperdício Total (m²)" value={fmtNum(metrics.totalDesperd)} />
            <SummaryRow label="Média de Desperdício (%)" value={fmtPct(metrics.mediaPerda)} />
            <SummaryRow label="Retalho Total (m²)" value={fmtNum(metrics.totalRetalho)} />
            <SummaryRow label="Maior Fator de Perda" value={fmtPct(metrics.fatorMax)} accent="text-destructive" />
            <SummaryRow label="Menor Fator de Perda" value={fmtPct(metrics.fatorMin)} accent="text-success" />
            <SummaryRow label="Quantidade de Itens" value={fmtInt(metrics.itens)} />
            <SummaryRow label="Total de Solicitações" value={fmtInt(metrics.solicitacoes)} />
            <SummaryRow label="Material mais desp." value={metrics.topMat?.[0] ?? "—"} />
            <SummaryRow label="Setor mais desp." value={metrics.topSetor?.[0] ?? "—"} />
          </div>
        </Panel>
      </section>

      {/* Detail table */}
      <section className="bg-card border border-border rounded-xl overflow-hidden">
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
                {["Tipo", "Nº", "Código", "Descrição", "Armazém", "Fator %", "Linha", "Qtde (m²)", "Data", "Retalho", "Status"].map(h => (
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
                  <td className="px-3 py-2 text-muted-foreground">{r.armazem}</td>
                  <td className="px-3 py-2 font-medium">{r.fator_perda !== null ? `${fmtNum(r.fator_perda, 0)}%` : "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.linha}</td>
                  <td className="px-3 py-2">{r.qtde_solicitada !== null ? fmtNum(r.qtde_solicitada) : "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">{fmtDate(r.data_registro)}</td>
                  <td className="px-3 py-2">{r.retalho !== null ? fmtNum(r.retalho) : "—"}</td>
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

function Panel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-card border border-border rounded-xl p-4 ${className}`}>
      <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-3">{title}</h3>
      {children}
    </div>
  );
}

function SummaryRow({ label, value, accent = "text-foreground" }: { label: string; value: string; accent?: string }) {
  return (
    <>
      <div className="text-muted-foreground">{label}</div>
      <div className={`text-right font-semibold ${accent}`}>{value}</div>
    </>
  );
}
