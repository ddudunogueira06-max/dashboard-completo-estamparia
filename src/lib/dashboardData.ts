import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { detectMaterial, m2ToKg, MATERIAL_LABEL } from "@/lib/material";

export interface WasteRow {
  id: string;
  descricao: string | null;
  fator_perda: number | null;
  qtde_solicitada: number | null;
  retalho: number | null;
  data_registro: string | null;
  tipo: string | null;
}

export interface ProdRow {
  id: string;
  produto: string | null;
  maquina: number | null;
  dt_prog: string | null;
  data_rg: string | null;
  tempo_execucao_seg: number | null;
}

export interface OeeDiaRow {
  data: string;
  maquina: number;
  turno: number;
  oee: number | null;
  paradas_prog_seg: number | null;
  paradas_nao_prog_seg: number | null;
}

export interface OeeParadaRow {
  categoria: string;
  total_seg: number;
  maquina: number;
  turno: number;
  mes_ref: string;
}

async function pagedSelect<T>(table: string, orderCol: string): Promise<T[]> {
  const pageSize = 1000;
  let from = 0;
  const all: T[] = [];
  for (;;) {
    const { data, error } = await supabase
      .from(table as never)
      .select("*")
      .order(orderCol, { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = (data ?? []) as unknown as T[];
    if (rows.length === 0) break;
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

export function useWaste() {
  return useQuery({
    queryKey: ["waste_records"],
    queryFn: () => pagedSelect<WasteRow>("waste_records", "data_registro"),
  });
}

export function useProduction() {
  return useQuery({
    queryKey: ["production_records"],
    queryFn: () => pagedSelect<ProdRow>("production_records", "dt_prog"),
  });
}

export function useOeeDias() {
  return useQuery({
    queryKey: ["oee_dias"],
    queryFn: async () => {
      const { data, error } = await supabase.from("oee_dias").select("*").order("data", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as OeeDiaRow[];
    },
  });
}

export function useOeeParadas() {
  return useQuery({
    queryKey: ["oee_paradas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("oee_paradas").select("*");
      if (error) throw error;
      return (data ?? []) as unknown as OeeParadaRow[];
    },
  });
}

/** Média ponderada de perda (% ) — mesma regra do painel de desperdícios. */
export function wasteWeightedLoss(rows: WasteRow[]): number {
  let num = 0;
  let den = 0;
  for (const r of rows) {
    const kg = m2ToKg(r.qtde_solicitada, r.descricao) || 0;
    const f = r.fator_perda;
    if (!kg || f === null || f === undefined) continue;
    num += kg * f;
    den += kg;
  }
  return den > 0 ? num / den : 0;
}

export function wasteTotalKg(rows: WasteRow[]): number {
  return rows.reduce((s, r) => s + (m2ToKg(r.qtde_solicitada, r.descricao) || 0), 0);
}

const MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

export function wasteByMonth(rows: WasteRow[]) {
  const map = new Map<string, WasteRow[]>();
  for (const r of rows) {
    if (!r.data_registro) continue;
    const d = new Date(r.data_registro);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const arr = map.get(key) ?? [];
    arr.push(r);
    map.set(key, arr);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([key, list]) => ({
      label: `${MONTHS[Number(key.slice(5, 7)) - 1]}/${key.slice(2, 4)}`,
      perda: Number(wasteWeightedLoss(list).toFixed(2)),
      kg: Math.round(wasteTotalKg(list)),
    }));
}

export function wasteByMaterial(rows: WasteRow[]) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const mat = detectMaterial(r.descricao);
    const label = MATERIAL_LABEL[mat];
    map.set(label, (map.get(label) ?? 0) + (m2ToKg(r.qtde_solicitada, r.descricao) || 0));
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value: Math.round(value) }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);
}

export function prodByMachine(rows: ProdRow[]) {
  const map = new Map<number, { pecas: number; seg: number }>();
  for (const r of rows) {
    if (r.maquina === null || r.maquina === undefined) continue;
    const cur = map.get(r.maquina) ?? { pecas: 0, seg: 0 };
    cur.pecas += 1;
    cur.seg += r.tempo_execucao_seg ?? 0;
    map.set(r.maquina, cur);
  }
  return Array.from(map.entries())
    // Somente as puncionadeiras reais (2000/3000/5000). Códigos auxiliares como 200 são ignorados.
    .filter(([maquina]) => maquina >= 1000)
    .sort((a, b) => a[0] - b[0])
    .map(([maquina, v]) => ({ label: `Máq ${maquina}`, pecas: v.pecas, horas: Number((v.seg / 3600).toFixed(1)) }));
}

export function prodByDay(rows: ProdRow[], days = 14) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const src = r.data_rg ?? r.dt_prog;
    if (!src) continue;
    const key = new Date(src).toISOString().slice(0, 10);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-days)
    .map(([key, pecas]) => ({ label: key.slice(8, 10) + "/" + key.slice(5, 7), pecas }));
}

export function oeeAverage(rows: OeeDiaRow[]): number {
  const vals = rows.map((r) => r.oee).filter((v): v is number => v !== null && v !== undefined);
  if (vals.length === 0) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export function oeeByDay(rows: OeeDiaRow[], days = 30) {
  const map = new Map<string, number[]>();
  for (const r of rows) {
    if (r.oee === null || r.oee === undefined) continue;
    const arr = map.get(r.data) ?? [];
    arr.push(r.oee);
    map.set(r.data, arr);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-days)
    .map(([data, vals]) => ({
      label: data.slice(8, 10) + "/" + data.slice(5, 7),
      oee: Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)),
    }));
}

export function paradasTop(rows: OeeParadaRow[], top = 8) {
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.categoria, (map.get(r.categoria) ?? 0) + r.total_seg);
  return Array.from(map.entries())
    .map(([label, seg]) => ({ label, horas: Number((seg / 3600).toFixed(1)) }))
    .sort((a, b) => b.horas - a.horas)
    .slice(0, top);
}
