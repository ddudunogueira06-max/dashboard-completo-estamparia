import { useCallback, useEffect, useState } from "react";
import type { MetricModule } from "@/components/widgets/metrics";

export type CustomKind = "kpi" | "bar" | "line" | "area" | "pie" | "texto";

export interface CustomWidget {
  id: string;
  title: string;
  module: MetricModule | "Geral";
  kind: CustomKind;
  /** para kpi: id da métrica · para gráficos: id da série */
  source?: string;
  /** chaves numéricas do gráfico */
  keys?: string[];
  /** texto livre (kind = texto) */
  text?: string;
  w: number;
  h: number;
}

const KEY = "dashboard.customWidgets.v1";

export function readCustomWidgets(): CustomWidget[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CustomWidget[]) : [];
  } catch {
    return [];
  }
}

export function useCustomWidgets() {
  const [list, setList] = useState<CustomWidget[]>([]);

  useEffect(() => setList(readCustomWidgets()), []);

  const persist = useCallback((next: CustomWidget[]) => {
    setList(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      window.dispatchEvent(new Event("custom-widgets-changed"));
    } catch {
      /* ignore */
    }
  }, []);

  const save = useCallback(
    (w: CustomWidget) => {
      const cur = readCustomWidgets();
      const i = cur.findIndex((x) => x.id === w.id);
      const next = i >= 0 ? cur.map((x) => (x.id === w.id ? w : x)) : [...cur, w];
      persist(next);
    },
    [persist],
  );

  const remove = useCallback(
    (id: string) => persist(readCustomWidgets().filter((x) => x.id !== id)),
    [persist],
  );

  useEffect(() => {
    const on = () => setList(readCustomWidgets());
    window.addEventListener("custom-widgets-changed", on);
    return () => window.removeEventListener("custom-widgets-changed", on);
  }, []);

  return { list, save, remove };
}

export const newCustomWidget = (): CustomWidget => ({
  id: `cw_${Date.now().toString(36)}`,
  title: "Novo widget",
  module: "Dobra",
  kind: "bar",
  source: "dobra.producao",
  keys: ["rgs"],
  w: 6,
  h: 4,
});
