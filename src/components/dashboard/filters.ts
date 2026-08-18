import { createContext, useContext } from "react";
import type { WidgetModule } from "@/components/widgets/registry";

export const FILTERS_KEY = "dashboard.filters.v1";

export interface DashboardFilters {
  /** Quantidade de pontos/dias exibidos nas séries temporais. 0 = tudo. */
  dias: number;
  /** Módulos visíveis no painel e no modo TV. */
  modules: WidgetModule[];
  /** Intervalo de datas (YYYY-MM-DD). Quando definido, tem prioridade sobre `dias`. */
  de?: string;
  ate?: string;
}

/** Converte o filtro em um intervalo concreto de datas. */
export function resolveRange(f: { dias: number; de?: string; ate?: string }) {
  if (f.de || f.ate) {
    const ate = f.ate ?? new Date().toISOString().slice(0, 10);
    const de = f.de ?? "0000-01-01";
    return { de, ate };
  }
  if (f.dias > 0) {
    const hoje = new Date();
    const ini = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - (f.dias - 1));
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { de: iso(ini), ate: iso(hoje) };
  }
  return null;
}

/** Nº de dias do intervalo (para recortar séries temporais). */
export function rangeDays(f: { dias: number; de?: string; ate?: string }) {
  const r = resolveRange(f);
  if (!r) return 0;
  if (r.de === "0000-01-01") return 0;
  const d = (Date.parse(r.ate) - Date.parse(r.de)) / 86400000 + 1;
  return d > 0 ? Math.round(d) : 0;
}

export const ALL_MODULES: WidgetModule[] = ["Programação", "Puncionadeira", "Dobra", "Geral"];

export const DEFAULT_FILTERS: DashboardFilters = { dias: 0, modules: ALL_MODULES };

export const PERIODOS = [
  { value: 7, label: "Últimos 7" },
  { value: 14, label: "Últimos 14" },
  { value: 30, label: "Últimos 30" },
  { value: 90, label: "Últimos 90" },
  { value: 0, label: "Tudo" },
];

export function loadFilters(): DashboardFilters {
  try {
    const raw = localStorage.getItem(FILTERS_KEY);
    if (!raw) return DEFAULT_FILTERS;
    const p = JSON.parse(raw) as Partial<DashboardFilters>;
    return {
      dias: typeof p.dias === "number" ? p.dias : 0,
      modules: Array.isArray(p.modules) && p.modules.length ? p.modules : ALL_MODULES,
      de: typeof p.de === "string" ? p.de : undefined,
      ate: typeof p.ate === "string" ? p.ate : undefined,
    };
  } catch {
    return DEFAULT_FILTERS;
  }
}

export function saveFilters(f: DashboardFilters) {
  try {
    localStorage.setItem(FILTERS_KEY, JSON.stringify(f));
  } catch {
    /* ignore */
  }
}

export const DashboardFilterContext = createContext<DashboardFilters>(DEFAULT_FILTERS);

export const useDashboardFilters = () => useContext(DashboardFilterContext);
