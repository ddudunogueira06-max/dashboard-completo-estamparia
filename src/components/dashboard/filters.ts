import { createContext, useContext } from "react";
import type { WidgetModule } from "@/components/widgets/registry";

export const FILTERS_KEY = "dashboard.filters.v1";

export interface DashboardFilters {
  /** Quantidade de pontos/dias exibidos nas séries temporais. 0 = tudo. */
  dias: number;
  /** Módulos visíveis no painel e no modo TV. */
  modules: WidgetModule[];
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
