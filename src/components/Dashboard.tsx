import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KpiCard } from "@/components/KpiCard";
import { fmtInt, fmtNum, fmtPct, fmtDate } from "@/lib/format";
import { exportToXLSX } from "@/lib/parseExcel";
import {
  detectMaterial, detectThicknessMm, m2ToKg, detailedCategory, filterCategory,
  MATERIAL_LABEL, type MaterialKind,
} from "@/lib/material";
import {
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend, LabelList,
} from "recharts";
import {
  ClipboardList, Percent, Trash2, Package, FileText, Download, RefreshCw, Search, CheckCircle2, FileDown, X,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { generateWasteReportPDF } from "@/lib/pdfReport";

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

const META_PERDA = 13; // meta global (%)

const META_POR_MATERIAL: Record<Exclude<MaterialKind, "outro">, number> = {
  galvanizado: 13,
  aluminio: 24,
  inox: 27,
};

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

// === FONTE ÚNICA DA VERDADE PARA MÉDIA DE PERDA ===
// Média ARITMÉTICA SIMPLES de TODOS os valores de fator_perda (coluna O) lançados.
// Sem ponderação por peso, sem dedupe — cada linha lançada conta 1×.
// Replica exatamente o cálculo de MÉDIA do Excel sobre a coluna O.
type FatorRow = { tipo: string | null; numero: number | null; id: string; detKey: string; fator_perda: number | null };
function uniqueFatores(rows: FatorRow[]): number[] {
  const out: number[] = [];
  for (const r of rows) {
    if (r.fator_perda === null) continue;
    out.push(r.fator_perda);
  }
  return out;
}

function meanOf(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}
function uniqueFppList(rows: FatorRow[]): string[] {
  const set = new Set<string>();
  rows.forEach(r => {
    if (r.numero !== null) set.add(`${(r.tipo ?? "").toUpperCase()} ${r.numero}`);
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
}

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
  const [numeroFilters, setNumeroFilters] = useState<string[]>([]);
  const [matrixYear, setMatrixYear] = useState<string>("");
  const [monthSel, setMonthSel] = useState<string>(""); // "" = mês atual com dados (1-12)

  const [kpiDetail, setKpiDetail] = useState<null | { title: string; kg?: number; m2?: number; pct?: number; count?: number; hint?: string; fpps?: string[] }>(null);

  const addNumeroFilter = () => {
    const v = search.trim();
    if (!v) return;
    setNumeroFilters(prev => prev.includes(v) ? prev : [...prev, v]);
    setSearch("");
  };
  const removeNumeroFilter = (v: string) => setNumeroFilters(prev => prev.filter(x => x !== v));

  const enriched = useMemo(() => records.map(r => {
    const material = detectMaterial(r.descricao);
    const thickness = detectThicknessMm(r.descricao);
    const det = detailedCategory(r.descricao);
    const fc = filterCategory(r.descricao);
    const qtde_m2 = r.qtde_solicitada ?? 0;
    const retalho_m2 = r.retalho ? Math.abs(r.retalho) : 0;
    return {
      ...r,
      material,
      thickness,
      matKey: fc?.key ?? "",
      matLabel: fc?.label ?? MATERIAL_LABEL[material],
      detKey: det?.key ?? "",
      detLabel: det?.label ?? "",
      qtde_m2,
      retalho_m2,
      qtde_kg: m2ToKg(r.qtde_solicitada, r.descricao),
      retalho_kg: m2ToKg(retalho_m2, r.descricao),
    };
  }), [records]);

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
    const nums = numeroFilters.map(n => n.toLowerCase());
    return enriched.filter((r) => {
      const t = r.data_registro ? new Date(r.data_registro).getTime() : 0;
      if (t < s || t > e) return false;
      if (tipoFilter && r.tipo !== tipoFilter) return false;
      if (materialFilter && r.matKey !== materialFilter) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      if (nums.length > 0) {
        const numStr = String(r.numero ?? "").toLowerCase();
        if (!nums.some(n => numStr === n || numStr.includes(n))) return false;
      }
      if (q) {
        const hay = `${r.codigo_item ?? ""} ${r.descricao ?? ""} ${r.numero ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [enriched, startDate, endDate, tipoFilter, materialFilter, statusFilter, search, numeroFilters]);

  // Agrupa por (tipo+numero). Para perda usamos somente a 1ª linha (menor "linha"),
  // mas os kg/m² somam todas as linhas do grupo.
  const groups = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    filtered.forEach(r => {
      const key = r.numero !== null ? `${r.tipo ?? ""}#${r.numero}` : `__solo__${r.id}`;
      const arr = map.get(key);
      if (arr) arr.push(r); else map.set(key, [r]);
    });
    map.forEach(arr => arr.sort((a, b) => (a.linha ?? 1e9) - (b.linha ?? 1e9)));
    return map;
  }, [filtered]);

  const metrics = useMemo(() => {
    let totalSolic = 0, totalSolic_m2 = 0, totalRetalho = 0, totalRetalho_m2 = 0;
    let estoqueBR0140_kg = 0, estoqueBR0140_m2 = 0;
    filtered.forEach(r => {
      totalSolic += r.qtde_kg;
      totalSolic_m2 += r.qtde_m2;
      totalRetalho += r.retalho_kg;
      totalRetalho_m2 += r.retalho_m2;
      estoqueBR0140_kg += r.retalho_kg;
      estoqueBR0140_m2 += r.retalho_m2;
    });
    let totalDesperd = 0, totalDesperd_m2 = 0;
    groups.forEach(rows => {
      const first = rows[0];
      const fator = (first.fator_perda ?? 0) / 100;
      const gKg = rows.reduce((a, r) => a + r.qtde_kg, 0);
      const gM2 = rows.reduce((a, r) => a + r.qtde_m2, 0);
      totalDesperd += gKg * fator;
      totalDesperd_m2 += gM2 * fator;
    });
    const totalProcessado = totalSolic - totalDesperd;
    const totalProcessado_m2 = totalSolic_m2 - totalDesperd_m2;
    // Média simples de perda — fonte única da verdade (ver uniqueFatores no topo do arquivo)
    const mediaPerda = meanOf(uniqueFatores(filtered));
    const fppList = uniqueFppList(filtered);
    const totalFPP = new Set(
      filtered.filter(r => (r.tipo ?? "").toUpperCase() === "FPP").map(r => r.numero).filter(n => n !== null)
    ).size;
    const fppListFPPonly = uniqueFppList(filtered.filter(r => (r.tipo ?? "").toUpperCase() === "FPP"));
    return {
      totalSolic, totalDesperd, totalProcessado, totalRetalho,
      totalSolic_m2, totalDesperd_m2, totalProcessado_m2, totalRetalho_m2,
      mediaPerda, totalFPP, estoqueBR0140_kg, estoqueBR0140_m2,
      fppList, fppListFPPonly,
    };
  }, [filtered, groups]);

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
    const materials: MaterialKind[] = ["inox", "galvanizado", "aluminio"];
    // Agrupa por (material, mês) e (material, ano) — usa fonte única uniqueFatores
    const buckets = new Map<string, FatorRow[]>(); // key: mat|m  ou  mat|year
    enriched.forEach(r => {
      if (!r.data_registro || !materials.includes(r.material)) return;
      if (tipoFilter && r.tipo !== tipoFilter) return;
      const d = new Date(r.data_registro);
      if (String(d.getFullYear()) !== yearSel) return;
      const m = d.getMonth();
      const mKey = `${r.material}|${m}`;
      const yKey = `${r.material}|Y`;
      (buckets.get(mKey) ?? buckets.set(mKey, []).get(mKey)!).push(r);
      (buckets.get(yKey) ?? buckets.set(yKey, []).get(yKey)!).push(r);
    });
    const avg = (rows: FatorRow[] | undefined) => {
      if (!rows || rows.length === 0) return null;
      const v = uniqueFatores(rows);
      return v.length ? +meanOf(v).toFixed(2) : null;
    };
    return materials.map(mat => {
      const monthly = Array.from({ length: 12 }, (_, i) => avg(buckets.get(`${mat}|${i}`)));
      const acumulada = avg(buckets.get(`${mat}|Y`));
      return { key: mat, material: mat, label: MATERIAL_LABEL[mat].toUpperCase(), monthly, acumulada, isSummary: true };
    }).filter(r => r.acumulada !== null);
  }, [enriched, yearSel, tipoFilter]);

  // === MATRIZ SEMANAL (Segunda a Sexta) por material — média simples por (material+espessura+fator) deduplicado por semana
  const weeklyMatrix = useMemo(() => {
    const materials: MaterialKind[] = ["inox", "galvanizado", "aluminio"];
    const getMonday = (d: Date) => {
      const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const day = x.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      x.setDate(x.getDate() + diff);
      return x;
    };

    // Agrupa registros brutos por semana+material e roda uniqueFatores em cada bucket
    const weekData = new Map<string, { start: Date; perMat: Map<MaterialKind, FatorRow[]> }>();

    enriched.forEach(r => {
      if (!r.data_registro || !materials.includes(r.material)) return;
      if (tipoFilter && r.tipo !== tipoFilter) return;
      const d = new Date(r.data_registro);
      if (String(d.getFullYear()) !== yearSel) return;
      const dow = d.getDay();
      if (dow === 0 || dow === 6) return;
      const mon = getMonday(d);
      const wkKey = `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, "0")}-${String(mon.getDate()).padStart(2, "0")}`;
      let wk = weekData.get(wkKey);
      if (!wk) {
        wk = { start: mon, perMat: new Map() };
        materials.forEach(m => wk!.perMat.set(m, []));
        weekData.set(wkKey, wk);
      }
      wk.perMat.get(r.material)!.push(r);
    });

    const weeks = Array.from(weekData.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, w]) => {
        const fri = new Date(w.start);
        fri.setDate(fri.getDate() + 4);
        const fmt = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
        return { key, label: `${fmt(w.start)}–${fmt(fri)}`, perMat: w.perMat };
      });

    const avg = (rows: FatorRow[]) => {
      if (rows.length === 0) return null;
      const v = uniqueFatores(rows);
      return v.length ? +meanOf(v).toFixed(2) : null;
    };

    const rows = materials.map(mat => {
      const weekly = weeks.map(w => avg(w.perMat.get(mat)!));
      // Acumulada da janela: aplica uniqueFatores em TODAS as semanas do material (mesma fonte)
      const allRows: FatorRow[] = [];
      weeks.forEach(w => allRows.push(...w.perMat.get(mat)!));
      const acumulada = avg(allRows);
      return { key: mat, material: mat, label: MATERIAL_LABEL[mat].toUpperCase(), weekly, acumulada };
    }).filter(r => r.acumulada !== null);

    return { weeks, rows };
  }, [enriched, yearSel, tipoFilter]);

  // Top 10 — Materiais com MAIOR FREQUÊNCIA de saída
  // (conta nº de ordens FPP/FPG distintas em que o código aparece)
  const topMateriais = useMemo(() => {
    const agg = new Map<string, { freq: Set<string>; qtde: number; desp: number; descricao: string }>();
    groups.forEach((rows, gKey) => {
      const first = rows[0];
      const fator = (first.fator_perda ?? 0) / 100;
      rows.forEach(r => {
        if (!r.codigo_item) return;
        const e = agg.get(r.codigo_item) ?? { freq: new Set<string>(), qtde: 0, desp: 0, descricao: r.descricao ?? "" };
        e.freq.add(gKey);
        e.qtde += r.qtde_kg;
        e.desp += r.qtde_kg * fator;
        if (!e.descricao && r.descricao) e.descricao = r.descricao;
        agg.set(r.codigo_item, e);
      });
    });
    return Array.from(agg.entries())
      .map(([codigo, v]) => ({
        codigo,
        descricao: v.descricao,
        label: v.descricao ? `${codigo} — ${v.descricao}` : codigo,
        freq: v.freq.size,
        desp: +v.desp.toFixed(2),
        qtde: +v.qtde.toFixed(2),
        media: v.qtde > 0 ? +(v.desp / v.qtde * 100).toFixed(2) : 0,
      }))
      .sort((a, b) => b.freq - a.freq)
      .slice(0, 10);
  }, [groups]);

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
    setStartDate(""); setEndDate(""); setTipoFilter(""); setMaterialFilter(""); setStatusFilter(""); setSearch(""); setNumeroFilters([]);
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

  const handleGeneratePDF = () => {
    const filtroResumo = [
      startDate || endDate ? `Período: ${startDate || "início"} → ${endDate || "hoje"}` : "Período: todos",
      tipoFilter && `Tipo: ${tipoFilter}`,
      materialFilter && `Material: ${materialFilter}`,
      statusFilter && `Status: ${statusFilter}`,
      search && `Busca: "${search}"`,
    ].filter(Boolean).join("  ·  ");
    generateWasteReportPDF(
      filtered.map(r => ({
        tipo: r.tipo, numero: r.numero, codigo_item: r.codigo_item, descricao: r.descricao,
        armazem: r.armazem, fator_perda: r.fator_perda, linha: r.linha,
        data_registro: r.data_registro, status: r.status,
        material: r.material, matLabel: r.matLabel, detLabel: r.detLabel,
        qtde_m2: r.qtde_m2, retalho_m2: r.retalho_m2,
        qtde_kg: r.qtde_kg, retalho_kg: r.retalho_kg,
      })),
      {
        solic_kg: metrics.totalSolic, desp_kg: metrics.totalDesperd,
        proc_kg: metrics.totalProcessado, retalho_kg: metrics.totalRetalho,
        solic_m2: metrics.totalSolic_m2, desp_m2: metrics.totalDesperd_m2,
        proc_m2: metrics.totalProcessado_m2, retalho_m2: metrics.totalRetalho_m2,
        mediaPerda: metrics.mediaPerda, itens: metrics.estoqueBR0140_kg, fpps: metrics.totalFPP,
        registros: filtered.length,
      },
      filtroResumo || "Sem filtros aplicados",
    );
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
          <button onClick={handleGeneratePDF} className="inline-flex items-center gap-2 rounded-md bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground hover:opacity-90">
            <FileDown className="size-4" /> <span className="hidden sm:inline">Gerar Relatório PDF</span>
          </button>
          <button onClick={handleExport} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            <Download className="size-4" /> <span className="hidden sm:inline">Exportar XLSX</span>
          </button>
        </div>
      </header>

      {/* === Filtro unificado FPP / FPG (afeta TODOS os gráficos e KPIs) === */}
      <section className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Tipo:</span>
        <div className="inline-flex rounded-md border border-border bg-card p-0.5">
          {[
            { v: "", label: "Todos" },
            { v: "FPP", label: "FPP" },
            { v: "FPG", label: "FPG" },
          ].map(opt => (
            <button
              key={opt.label}
              onClick={() => setTipoFilter(opt.v)}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                tipoFilter === opt.v
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-muted-foreground hidden sm:inline">
          aplica-se a todos os indicadores e gráficos
        </span>
      </section>

      {/* === Filtros === */}
      <section className="bg-card border border-border rounded-xl p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <Field label="Data inicial">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Data final">
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
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
          <Field label="FPP / FPG (Enter p/ adicionar)">
            <div className="relative">
              <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNumeroFilter(); } }}
                placeholder="Nº da FPP/FPG…"
                className={`${inputCls} pl-8`}
              />
            </div>
          </Field>
          <Field label="Ação">
            <button onClick={addNumeroFilter} type="button" className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
              + Adicionar ao filtro
            </button>
          </Field>
        </div>
        {numeroFilters.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold self-center">Filtrando FPP/FPG:</span>
            {numeroFilters.map(n => (
              <span key={n} className="inline-flex items-center gap-1 rounded-full bg-primary/15 text-primary px-2.5 py-1 text-xs font-semibold">
                {n}
                <button type="button" onClick={() => removeNumeroFilter(n)} className="hover:bg-primary/25 rounded-full p-0.5">
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="mt-3 flex justify-end">
          <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
            Limpar filtros
          </button>
        </div>
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Total Solicitado (kg)" value={fmtNum(metrics.totalSolic)} icon={ClipboardList} accent="primary" onClick={() => setKpiDetail({ title: "Total Solicitado", kg: metrics.totalSolic, m2: metrics.totalSolic_m2, fpps: metrics.fppList, hint: `${metrics.fppList.length} FPP/FPG distintas` })} />
        <KpiCard label="Total Processado (kg)" value={fmtNum(metrics.totalProcessado)} icon={CheckCircle2} accent="success" onClick={() => setKpiDetail({ title: "Total Processado", kg: metrics.totalProcessado, m2: metrics.totalProcessado_m2, fpps: metrics.fppList, hint: `${metrics.fppList.length} FPP/FPG distintas` })} />
        <KpiCard label="Desperdício Total (kg)" value={fmtNum(metrics.totalDesperd)} icon={Trash2} accent="destructive" onClick={() => setKpiDetail({ title: "Desperdício Total", kg: metrics.totalDesperd, m2: metrics.totalDesperd_m2, fpps: metrics.fppList, hint: `${metrics.fppList.length} FPP/FPG com desperdício` })} />
        <KpiCard label="Média de Perda (%)" value={fmtPct(metrics.mediaPerda)} icon={Percent} accent="warning" hint={`meta ${META_PERDA}%`} onClick={() => setKpiDetail({ title: "Média de Perda — média simples dos valores lançados", pct: metrics.mediaPerda, fpps: metrics.fppList, hint: `Meta: ${META_PERDA}% · dedup por FPP+material+espessura+fator` })} />
        <KpiCard label="Qtd estoque BR0140 (kg)" value={fmtNum(metrics.estoqueBR0140_kg)} icon={Package} accent="success" onClick={() => setKpiDetail({ title: "Qtd estoque BR0140", kg: metrics.estoqueBR0140_kg, m2: metrics.estoqueBR0140_m2, hint: "Total de retalho enviado ao armazém BR0140 (conforme filtros)" })} />
        <KpiCard label="Total de FPPs" value={fmtInt(metrics.totalFPP)} icon={FileText} accent="primary" onClick={() => setKpiDetail({ title: "Total de FPPs", count: metrics.totalFPP, fpps: metrics.fppListFPPonly, hint: "Ordens distintas do tipo FPP" })} />
      </section>

      {/* === MATRIZ MENSAL POR CATEGORIA === */}
      <section>
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
                    <tr key={row.key} className={`border-t border-border ${row.isSummary ? "bg-secondary/30" : ""}`}>
                      <td className={`px-3 py-2.5 whitespace-nowrap ${row.isSummary ? "font-bold uppercase text-xs tracking-wider" : "font-semibold"}`}>
                        <span
                          className="inline-block size-2.5 rounded-full mr-2 align-middle"
                          style={{ background: MATERIAL_COLOR[row.material] }}
                        />
                        {row.label}
                      </td>
                      <td className="px-2 py-2.5 text-center text-muted-foreground font-medium">{META_POR_MATERIAL[row.material as Exclude<MaterialKind, "outro">].toFixed(2)}%</td>
                      {row.monthly.map((v, i) => (
                        <td key={i} className="px-2 py-2.5 text-center font-mono">
                          {v === null ? <span className="text-muted-foreground/50">—</span> : (
                            <span className={v > META_POR_MATERIAL[row.material as Exclude<MaterialKind, "outro">] ? "text-destructive font-semibold" : "text-success font-medium"}>
                              {fmtPct(v)}
                            </span>
                          )}
                        </td>
                      ))}
                      <td className="px-2 py-2.5 text-center font-mono font-bold">
                        {row.acumulada === null ? "—" : (
                          <span className={row.acumulada > META_POR_MATERIAL[row.material as Exclude<MaterialKind, "outro">] ? "text-destructive" : "text-success"}>
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
                <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-destructive" /> acima da meta (GALV 13% · ALUM 24% · INOX 27%)</span>
              </div>
            </div>
          )}

        </Panel>
      </section>

      {/* === DESPERDÍCIO POR SEMANA DENTRO DO MÊS (Seg–Sex) === */}
      <section>
        {(() => {
          const weeks = weeklyMatrix.weeks;
          // detecta meses disponíveis (a partir de uma data label dd/mm)
          const monthsWithData = Array.from(new Set(weeks.map(w => {
            const [, mm] = w.label.split("–")[0].split("/");
            return mm;
          }))).sort();
          const defaultMonth = monthsWithData[monthsWithData.length - 1] ?? "";
          const activeMonth = monthSel && monthsWithData.includes(monthSel) ? monthSel : defaultMonth;
          const weekIdxOfMonth = weeks
            .map((w, i) => ({ w, i }))
            .filter(({ w }) => w.label.split("–")[0].split("/")[1] === activeMonth);
          const monthLabel = activeMonth ? MONTH_NAMES[Number(activeMonth) - 1] : "—";
          return (
            <Panel
              title={`Desperdício por Semana — ${monthLabel}/${yearSel}`}
              right={
                <select
                  value={activeMonth}
                  onChange={(e) => setMonthSel(e.target.value)}
                  className={`${inputCls} max-w-[140px] py-1 text-xs`}
                >
                  {monthsWithData.length === 0 && <option value="">Sem dados</option>}
                  {monthsWithData.map(m => (
                    <option key={m} value={m}>{MONTH_NAMES[Number(m) - 1]}</option>
                  ))}
                </select>
              }
            >
              {weekIdxOfMonth.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">Sem dados semanais para o mês selecionado.</div>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-sm border-separate border-spacing-0">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        <th className="text-left px-3 py-2 bg-secondary/40 rounded-l-md">Indicador</th>
                        <th className="px-2 py-2 bg-secondary/40">Meta</th>
                        {weekIdxOfMonth.map(({ w }) => (
                          <th key={w.key} className="px-2 py-2 bg-secondary/40 whitespace-nowrap">{w.label}</th>
                        ))}
                        <th className="px-2 py-2 bg-secondary/40 rounded-r-md">Média<br/>do Mês</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weeklyMatrix.rows.map(row => {
                        const meta = META_POR_MATERIAL[row.material as Exclude<MaterialKind, "outro">];
                        // Média do Mês — mesma fonte única (uniqueFatores). Considera todos os
                        // dias do mês (inclui registros lançados em fim-de-semana, se houver),
                        // garantindo que esta média seja exatamente a média das semanas do mês.
                        const rowsMes = enriched.filter(r => {
                          if (!r.data_registro || r.material !== row.material) return false;
                          if (tipoFilter && r.tipo !== tipoFilter) return false;
                          const d = new Date(r.data_registro);
                          if (String(d.getFullYear()) !== yearSel) return false;
                          if (String(d.getMonth() + 1).padStart(2, "0") !== activeMonth) return false;
                          const dow = d.getDay();
                          if (dow === 0 || dow === 6) return false;
                          return true;
                        });
                        const valsMes = uniqueFatores(rowsMes);
                        const mediaMes = valsMes.length > 0 ? +meanOf(valsMes).toFixed(2) : null;
                        return (
                          <tr key={row.key} className="border-t border-border bg-secondary/30">
                            <td className="px-3 py-2.5 whitespace-nowrap font-bold uppercase text-xs tracking-wider">
                              <span className="inline-block size-2.5 rounded-full mr-2 align-middle" style={{ background: MATERIAL_COLOR[row.material] }} />
                              {row.label}
                            </td>
                            <td className="px-2 py-2.5 text-center text-muted-foreground font-medium">{meta.toFixed(2)}%</td>
                            {weekIdxOfMonth.map(({ w, i }) => {
                              const v = row.weekly[i];
                              return (
                                <td key={w.key} className="px-2 py-2.5 text-center font-mono">
                                  {v === null || v === undefined ? <span className="text-muted-foreground/50">—</span> : (
                                    <span className={v > meta ? "text-destructive font-semibold" : "text-success font-medium"}>{fmtPct(v)}</span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="px-2 py-2.5 text-center font-mono font-bold">
                              {mediaMes === null ? "—" : (
                                <span className={mediaMes > meta ? "text-destructive" : "text-success"}>{fmtPct(mediaMes)}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}

                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          );
        })()}
      </section>




      {/* Charts row */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="Top 10 — Materiais com maior frequência de saída" className="lg:col-span-2">
          <div className="h-[460px]">
            {topMateriais.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer>
              <BarChart data={topMateriais} layout="vertical" margin={{ left: 8, right: 110 }}>
                <CartesianGrid stroke="oklch(0.3 0.03 250)" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" stroke="oklch(0.72 0.03 240)" fontSize={11} allowDecimals={false} />
                <YAxis type="category" dataKey="label" stroke="oklch(0.72 0.03 240)" fontSize={10} width={300} interval={0} tick={{ fill: "oklch(0.85 0.02 240)" }} />
                <Tooltip
                  contentStyle={{ background: "oklch(0.22 0.04 250)", border: "1px solid oklch(0.3 0.03 250)", borderRadius: 8, color: "oklch(0.97 0.01 240)" }}
                  formatter={(_v: number, _n, item) => {
                    const p = item?.payload as { freq: number; qtde: number; media: number };
                    return [`${p.freq} ordens · ${fmtNum(p.qtde)} kg · ${fmtPct(p.media)} médio`, "Saídas"];
                  }}
                  labelFormatter={(l) => String(l)}
                />
                <Bar dataKey="freq" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]}>
                  <LabelList
                    dataKey="freq"
                    position="right"
                    content={((props: Record<string, unknown>) => {
                      const x = Number(props.x ?? 0);
                      const y = Number(props.y ?? 0);
                      const width = Number(props.width ?? 0);
                      const height = Number(props.height ?? 0);
                      const index = Number(props.index ?? 0);
                      const p = topMateriais[index];
                      if (!p) return null;
                      return (
                        <text x={x + width + 6} y={y + height / 2} fill="oklch(0.95 0.01 240)" fontSize={11} fontWeight={600} dominantBaseline="middle">
                          {`${p.freq}× · ${fmtNum(p.qtde, 0)} kg`}
                        </text>
                      );
                    }) as never}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            )}
          </div>
        </Panel>


        <Panel title="Distribuição do Fator de Perda">
          <div className="h-[460px]">
            {filtered.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={distribuicao}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={70}
                  outerRadius={140}
                  paddingAngle={2}
                  label={(d) => `${d.pct}%`}
                  labelLine={false}
                >
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


      {/* Detail table */}
      <DetailTable filtered={filtered} />

      <Dialog open={!!kpiDetail} onOpenChange={(o) => !o && setKpiDetail(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{kpiDetail?.title}</DialogTitle>
            <DialogDescription>Conversão entre unidades e detalhes do indicador.</DialogDescription>
          </DialogHeader>
          {kpiDetail && (
            <div className="grid grid-cols-2 gap-3 pt-2">
              {kpiDetail.kg !== undefined && (
                <div className="rounded-lg border border-border bg-secondary/30 p-4">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Em quilos</div>
                  <div className="mt-1 text-2xl font-extrabold text-foreground">{fmtNum(kpiDetail.kg)}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">kg</div>
                </div>
              )}
              {kpiDetail.m2 !== undefined && (
                <div className="rounded-lg border border-border bg-primary/10 p-4">
                  <div className="text-[10px] uppercase tracking-wider text-primary font-semibold">Em metros²</div>
                  <div className="mt-1 text-2xl font-extrabold text-foreground">{fmtNum(kpiDetail.m2)}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">m²</div>
                </div>
              )}
              {kpiDetail.pct !== undefined && (
                <div className="col-span-2 rounded-lg border border-border bg-warning/10 p-4">
                  <div className="text-[10px] uppercase tracking-wider text-warning font-semibold">Percentual</div>
                  <div className="mt-1 text-3xl font-extrabold text-foreground">{fmtPct(kpiDetail.pct)}</div>
                  {kpiDetail.hint && <div className="text-xs text-muted-foreground mt-1">{kpiDetail.hint}</div>}
                </div>
              )}
              {kpiDetail.count !== undefined && (
                <div className="col-span-2 rounded-lg border border-border bg-accent/10 p-4">
                  <div className="text-[10px] uppercase tracking-wider text-accent font-semibold">Quantidade</div>
                  <div className="mt-1 text-3xl font-extrabold text-foreground">{fmtInt(kpiDetail.count)}</div>
                  {kpiDetail.hint && <div className="text-xs text-muted-foreground mt-1">{kpiDetail.hint}</div>}
                </div>
              )}
            </div>
          )}
          {kpiDetail?.fpps && kpiDetail.fpps.length > 0 && (
            <div className="mt-3 rounded-lg border border-border bg-secondary/20 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                FPPs / FPGs ({kpiDetail.fpps.length})
              </div>
              <div className="max-h-48 overflow-auto flex flex-wrap gap-1.5">
                {kpiDetail.fpps.map(n => (
                  <span key={n} className="inline-flex items-center rounded-md bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-mono font-medium">{n}</span>
                ))}
              </div>
            </div>
          )}
          <button
            onClick={handleGeneratePDF}
            className="mt-2 inline-flex items-center justify-center gap-2 rounded-md bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground hover:opacity-90"
          >
            <FileDown className="size-4" /> Gerar Relatório PDF Completo
          </button>
        </DialogContent>
      </Dialog>
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

interface DetailRow {
  id: string;
  tipo: string | null;
  numero: number | null;
  codigo_item: string | null;
  descricao: string | null;
  status: string | null;
  data_registro: string | null;
  linha: number | null;
  fator_perda: number | null;
  qtde_kg: number;
  material: MaterialKind;
  detLabel: string;
}

function DetailTable({ filtered }: { filtered: DetailRow[] }) {
  const [fTipo, setFTipo] = useState("");
  const [fNumero, setFNumero] = useState("");
  const [fCodigo, setFCodigo] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fCat, setFCat] = useState("");
  const [fStatus, setFStatus] = useState("");

  const tipos = useMemo(() => Array.from(new Set(filtered.map(r => r.tipo).filter(Boolean))) as string[], [filtered]);
  const cats = useMemo(() => Array.from(new Set(filtered.map(r => r.detLabel).filter(Boolean))).sort(), [filtered]);
  const statuses2 = useMemo(() => Array.from(new Set(filtered.map(r => r.status).filter(Boolean))) as string[], [filtered]);

  const rows = useMemo(() => filtered.filter(r => {
    if (fTipo && r.tipo !== fTipo) return false;
    if (fStatus && r.status !== fStatus) return false;
    if (fCat && r.detLabel !== fCat) return false;
    if (fNumero && !String(r.numero ?? "").toLowerCase().includes(fNumero.toLowerCase())) return false;
    if (fCodigo && !(r.codigo_item ?? "").toLowerCase().includes(fCodigo.toLowerCase())) return false;
    if (fDesc && !(r.descricao ?? "").toLowerCase().includes(fDesc.toLowerCase())) return false;
    return true;
  }), [filtered, fTipo, fNumero, fCodigo, fDesc, fCat, fStatus]);

  const avgFator = useMemo(() => {
    // Mesma fonte única (uniqueFatores) — usa detLabel como chave de material+espessura
    const mapped: FatorRow[] = rows.map(r => ({ tipo: r.tipo, numero: r.numero, id: r.id, detKey: r.detLabel, fator_perda: r.fator_perda }));
    return meanOf(uniqueFatores(mapped));
  }, [rows]);
  const avgKg = useMemo(() => {
    const v = rows.filter(r => r.qtde_kg > 0).map(r => r.qtde_kg);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
  }, [rows]);
  const sumKg = useMemo(() => rows.reduce((a, r) => a + r.qtde_kg, 0), [rows]);

  const filtCls = "w-full rounded border border-input bg-background/50 px-2 py-1 text-[11px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <section className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Detalhamento das Solicitações</h3>
        <span className="text-xs text-muted-foreground">{fmtInt(rows.length)} de {fmtInt(filtered.length)} linhas</span>
      </div>
      <div className="overflow-auto max-h-[520px]">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 sticky top-0 z-10">
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              {["Tipo", "Nº", "Código", "Descrição", "Categoria", "Fator %", "Linha", "Qtde (kg)", "Data", "Status"].map(h => (
                <th key={h} className="px-3 py-2 font-medium">{h}</th>
              ))}
            </tr>
            <tr className="bg-secondary/20">
              <th className="px-2 py-1.5">
                <select value={fTipo} onChange={e => setFTipo(e.target.value)} className={filtCls}>
                  <option value="">Todos</option>
                  {tipos.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </th>
              <th className="px-2 py-1.5"><input value={fNumero} onChange={e => setFNumero(e.target.value)} placeholder="filtrar…" className={filtCls} /></th>
              <th className="px-2 py-1.5"><input value={fCodigo} onChange={e => setFCodigo(e.target.value)} placeholder="filtrar…" className={filtCls} /></th>
              <th className="px-2 py-1.5"><input value={fDesc} onChange={e => setFDesc(e.target.value)} placeholder="filtrar…" className={filtCls} /></th>
              <th className="px-2 py-1.5">
                <select value={fCat} onChange={e => setFCat(e.target.value)} className={filtCls}>
                  <option value="">Todas</option>
                  {cats.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </th>
              <th className="px-2 py-1.5"></th>
              <th className="px-2 py-1.5"></th>
              <th className="px-2 py-1.5"></th>
              <th className="px-2 py-1.5"></th>
              <th className="px-2 py-1.5">
                <select value={fStatus} onChange={e => setFStatus(e.target.value)} className={filtCls}>
                  <option value="">Todos</option>
                  {statuses2.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 500).map((r) => (
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
                <td className="px-3 py-2"><span className="text-xs text-success">{r.status}</span></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={10} className="px-3 py-10 text-center text-muted-foreground">Nenhum registro com esses filtros.</td></tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="bg-secondary/60 border-t-2 border-border sticky bottom-0">
              <tr className="text-xs uppercase tracking-wider font-bold">
                <td className="px-3 py-2.5" colSpan={5}>Média / Soma</td>
                <td className="px-3 py-2.5 font-mono">{fmtPct(avgFator)}</td>
                <td className="px-3 py-2.5"></td>
                <td className="px-3 py-2.5 font-mono">
                  <div>μ {fmtNum(avgKg)}</div>
                  <div className="text-[10px] font-normal text-muted-foreground">Σ {fmtNum(sumKg)}</div>
                </td>
                <td className="px-3 py-2.5"></td>
                <td className="px-3 py-2.5"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {rows.length > 500 && (
        <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border bg-secondary/20">
          Exibindo as primeiras 500 linhas. Use os filtros ou exporte para ver todas.
        </div>
      )}
    </section>
  );
}

