import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { GridBoard, type GridItem } from "@/components/dashboard/GridBoard";
import { WIDGETS, WIDGET_MAP, type WidgetModule } from "@/components/widgets/registry";
import { useTickerMetrics } from "@/components/widgets/metrics";
import {
  ALL_MODULES,
  DashboardFilterContext,
  PERIODOS,
  loadFilters,
  saveFilters,
  type DashboardFilters,
} from "@/components/dashboard/filters";
import { LayoutGrid, Plus, Save, RotateCcw, Tv, Settings2, X, Cloud } from "lucide-react";
import {
  LAYOUT_KEY,
  TICKER_KEY,
  fetchSharedDashboard,
  saveSharedDashboard,
  readLocal,
  writeLocal,
} from "@/lib/dashboardConfig";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const STORAGE_KEY = LAYOUT_KEY;




interface Placed extends GridItem {
  widgetId: string;
}

const DEFAULT_LAYOUT: Placed[] = [
  { i: "w1", widgetId: "waste.kpi.perda", x: 0, y: 0, w: 3, h: 2 },
  { i: "w2", widgetId: "prod.kpi.pecas", x: 3, y: 0, w: 3, h: 2 },
  { i: "w3", widgetId: "oee.kpi.medio", x: 6, y: 0, w: 3, h: 2 },
  { i: "w4", widgetId: "geral.ticker", x: 9, y: 0, w: 3, h: 4 },
  { i: "w5", widgetId: "waste.chart.mensal", x: 0, y: 2, w: 5, h: 4 },
  { i: "w6", widgetId: "oee.chart.diario", x: 5, y: 2, w: 4, h: 4 },
  { i: "w7", widgetId: "prod.chart.maquina", x: 0, y: 6, w: 6, h: 4 },
  { i: "w8", widgetId: "oee.chart.paradas", x: 6, y: 6, w: 6, h: 4 },
];

const MODULE_COLOR: Record<WidgetModule, string> = {
  "Programação": "bg-primary/15 text-primary",
  Puncionadeira: "bg-accent/15 text-accent",
  Dobra: "bg-muted text-muted-foreground",
  Geral: "bg-secondary text-foreground",
};

export function ModularDashboard() {
  const [items, setItems] = useState<Placed[]>(DEFAULT_LAYOUT);
  const [editing, setEditing] = useState(false);
  const [palette, setPalette] = useState(false);
  const [tickerCfg, setTickerCfg] = useState(false);
  const [busca, setBusca] = useState("");
  const [modFiltro, setModFiltro] = useState<WidgetModule | "Todos">("Todos");
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [filtros, setFiltros] = useState<DashboardFilters>({ dias: 0, modules: ALL_MODULES });
  const loaded = useRef(false);
  const [saving, setSaving] = useState(false);
  const { metrics } = useTickerMetrics();
  const { isAdmin } = useAuth();

  useEffect(() => {
    // 1) cache local (rápido) 2) configuração compartilhada do banco (vale para todos)
    const local = readLocal<Placed[]>(STORAGE_KEY);
    if (Array.isArray(local) && local.length) setItems(local);
    const t = readLocal<string[]>(TICKER_KEY);
    if (Array.isArray(t)) setSelectedMetrics(t);
    setFiltros(loadFilters());
    loaded.current = true;

    fetchSharedDashboard().then((cfg) => {
      if (!cfg) return;
      if (Array.isArray(cfg.layout) && cfg.layout.length) {
        setItems(cfg.layout as Placed[]);
        writeLocal(STORAGE_KEY, cfg.layout);
      }
      if (Array.isArray(cfg.ticker)) {
        setSelectedMetrics(cfg.ticker);
        writeLocal(TICKER_KEY, cfg.ticker);
      }
    });
  }, []);

  const persist = useCallback((next: Placed[]) => {
    setItems(next);
    if (!loaded.current) return;
    writeLocal(STORAGE_KEY, next);
  }, []);

  const publicar = async () => {
    setSaving(true);
    const err = await saveSharedDashboard({ layout: items, ticker: selectedMetrics });
    setSaving(false);
    if (err) toast.error("Não foi possível salvar para todos: " + err);
    else toast.success("Painel salvo para todos os usuários.");
  };

  const setFiltrosPersist = (patch: Partial<DashboardFilters>) => {
    const next = { ...filtros, ...patch };
    setFiltros(next);
    saveFilters(next);
  };


  const toggleMetric = (id: string) => {
    const next = selectedMetrics.includes(id)
      ? selectedMetrics.filter((m) => m !== id)
      : [...selectedMetrics, id];
    setSelectedMetrics(next);
    writeLocal(TICKER_KEY, next);
  };


  const addWidget = (widgetId: string) => {
    const def = WIDGET_MAP.get(widgetId);
    if (!def) return;
    const maxY = items.reduce((m, it) => Math.max(m, it.y + it.h), 0);
    persist([
      ...items,
      { i: `w${Date.now()}`, widgetId, x: 0, y: maxY, w: def.defaultW, h: def.defaultH },
    ]);
    setEditing(true);
    setPalette(false);
  };

  const duplicate = (item: Placed) => {
    persist([...items, { ...item, i: `w${Date.now()}`, y: item.y + item.h }]);
    setEditing(true);
  };

  const grouped = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const g = new Map<WidgetModule, typeof WIDGETS>();
    for (const w of WIDGETS) {
      if (modFiltro !== "Todos" && w.module !== modFiltro) continue;
      if (q && !`${w.title} ${w.module} ${w.description ?? ""}`.toLowerCase().includes(q)) continue;
      g.set(w.module, [...(g.get(w.module) ?? []), w]);
    }
    return Array.from(g.entries());
  }, [busca, modFiltro]);

  const usados = useMemo(() => new Set(items.map((i) => i.widgetId)), [items]);

  const visiveis = useMemo(
    () =>
      editing
        ? items
        : items.filter((it) => filtros.modules.includes(WIDGET_MAP.get(it.widgetId)?.module ?? "Geral")),
    [items, editing, filtros.modules],
  );

  return (
    <DashboardFilterContext.Provider value={filtros}>
    <div className="p-4 md:p-6 space-y-4">

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <LayoutGrid className="size-6 text-primary" /> Painel
          </h1>
          <p className="text-sm text-muted-foreground">
            Widgets de Programação, Puncionadeira e Dobra — arraste, redimensione e organize.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/painel-tv"
            className="inline-flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm hover:bg-accent"
          >
            <Tv className="size-4" /> Modo TV
          </Link>
          <button
            onClick={() => setTickerCfg(true)}
            className="inline-flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm hover:bg-accent"
          >
            <Settings2 className="size-4" /> Painel rotativo
          </button>
          <button
            onClick={() => setPalette(true)}
            className="inline-flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm hover:bg-accent"
          >
            <Plus className="size-4" /> Adicionar widget
          </button>
          <button
            onClick={() => persist(DEFAULT_LAYOUT)}
            className="inline-flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm hover:bg-accent"
            title="Restaurar layout padrão"
          >
            <RotateCcw className="size-4" />
          </button>
          {isAdmin && (
            <button
              onClick={publicar}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm hover:bg-accent disabled:opacity-60"
              title="Salvar este painel como padrão para todos os usuários"
            >
              <Cloud className="size-4" /> {saving ? "Salvando..." : "Salvar para todos"}
            </button>
          )}
          <button
            onClick={() => {
              const next = !editing;
              setEditing(next);
              if (!next && isAdmin) void publicar();
            }}
            className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
              editing ? "bg-primary text-primary-foreground" : "border border-input hover:bg-accent"
            }`}
          >
            {editing ? <Save className="size-4" /> : <LayoutGrid className="size-4" />}
            {editing ? "Concluir edição" : "Editar layout"}
          </button>

        </div>
      </div>

      {editing && (
        <div className="rounded-lg border border-primary/40 bg-primary/10 px-4 py-2.5 text-sm text-foreground">
          Modo de edição: arraste o cabeçalho do widget para mover, use o canto inferior direito para
          redimensionar e o X para remover. Clique em <b>Concluir edição</b> para salvar — o layout fica salvo neste navegador.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Período</span>
        <select
          value={filtros.dias}
          onChange={(e) => setFiltrosPersist({ dias: Number(e.target.value) })}
          className="h-7 rounded-md border border-border bg-input px-2 text-xs"
          aria-label="Período dos gráficos"
        >
          {PERIODOS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <span className="ml-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Exibir</span>
        {ALL_MODULES.map((m) => {
          const on = filtros.modules.includes(m);
          return (
            <button
              key={m}
              onClick={() =>
                setFiltrosPersist({
                  modules: on ? filtros.modules.filter((x) => x !== m) : [...filtros.modules, m],
                })
              }
              className={`rounded-md px-2.5 py-1 text-xs ${on ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:bg-secondary"}`}
            >
              {m}
            </button>
          );
        })}
        <span className="ml-auto text-xs text-muted-foreground">
          {visiveis.length} de {items.length} widgets · vale também para o Modo TV
        </span>
      </div>

      <GridBoard
        items={visiveis}
        editing={editing}
        onChange={(next) =>
          persist(
            items.map((it) => {
              const n = next.find((x) => x.i === it.i);
              return n ? { ...it, x: n.x, y: n.y, w: n.w, h: n.h } : it;
            }),
          )
        }

        onRemove={(id) => persist(items.filter((it) => it.i !== id))}
        onDuplicate={(id) => {
          const it = items.find((x) => x.i === id);
          if (it) duplicate(it);
        }}
        titleFor={(it) => WIDGET_MAP.get((it as Placed).widgetId)?.title ?? "Widget"}
        renderItem={(it) => {
          const def = WIDGET_MAP.get((it as Placed).widgetId);
          if (!def) return <div className="p-3 text-xs text-muted-foreground">Widget indisponível</div>;
          const C = def.Component;
          return <C config={{ metrics: selectedMetrics }} />;
        }}
      />

      {palette && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setPalette(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative ml-auto h-full w-full max-w-md bg-card border-l border-border p-5 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Biblioteca de widgets</h2>
              <button onClick={() => setPalette(false)} className="p-1.5 rounded hover:bg-muted">
                <X className="size-4" />
              </button>
            </div>
            <input
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Pesquisar widget..."
              className="mb-3 w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            />
            <div className="mb-4 flex flex-wrap gap-1.5">
              {(["Todos", "Programação", "Puncionadeira", "Dobra", "Geral"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setModFiltro(m)}
                  className={`rounded-md px-2.5 py-1 text-xs ${
                    modFiltro === m ? "bg-primary text-primary-foreground" : "border border-border hover:bg-secondary"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            {grouped.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum widget encontrado para "{busca}".</p>
            )}
            <div className="space-y-5">
              {grouped.map(([mod, list]) => (
                <div key={mod}>
                  <div className={`inline-block text-[11px] px-2 py-0.5 rounded mb-2 ${MODULE_COLOR[mod]}`}>{mod}</div>
                  <div className="space-y-2">
                    {list.map((w) => (
                      <button
                        key={w.id}
                        onClick={() => addWidget(w.id)}
                        className="w-full text-left rounded-lg border border-border px-3 py-2.5 text-sm hover:border-primary hover:bg-secondary/40"
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="font-medium">{w.title}</span>
                          {usados.has(w.id) && (
                            <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              no painel
                            </span>
                          )}
                        </span>
                        {w.description && (
                          <span className="mt-0.5 block text-xs text-muted-foreground">{w.description}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tickerCfg && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setTickerCfg(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative ml-auto h-full w-full max-w-md bg-card border-l border-border p-5 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-semibold">Painel rotativo</h2>
              <button onClick={() => setTickerCfg(false)} className="p-1.5 rounded hover:bg-muted">
                <X className="size-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Selecione as informações que devem passar lentamente no widget e no Modo TV.
            </p>
            <div className="space-y-2">
              {metrics.map((m) => (
                <label
                  key={m.id}
                  className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm cursor-pointer hover:bg-secondary/40"
                >
                  <input
                    type="checkbox"
                    checked={selectedMetrics.includes(m.id)}
                    onChange={() => toggleMetric(m.id)}
                    className="size-4"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block truncate">{m.label}</span>
                    <span className="block text-xs text-muted-foreground">{m.module} · {m.value}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
    </DashboardFilterContext.Provider>

  );
}
