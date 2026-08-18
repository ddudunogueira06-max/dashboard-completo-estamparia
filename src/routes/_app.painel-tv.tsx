import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { TickerPanel } from "@/components/TickerPanel";
import { MODULE_ACCENT, WIDGET_MAP } from "@/components/widgets/registry";
import { ArrowLeft, Pause, Play } from "lucide-react";
import {
  DEFAULT_FILTERS,
  DashboardFilterContext,
  loadFilters,
  type DashboardFilters,
} from "@/components/dashboard/filters";
import { fetchSharedDashboard } from "@/lib/dashboardConfig";



export const Route = createFileRoute("/_app/painel-tv")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Modo TV — Painel Rotativo" },
      { name: "description", content: "Exibição em tela cheia dos indicadores selecionados, em rotação automática." },
      { property: "og:title", content: "Modo TV — Painel Rotativo" },
      { property: "og:description", content: "Indicadores em rotação automática para exibição em TV." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PainelTv,
});

interface Placed {
  i: string;
  widgetId: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const COLS = 12;
/** Altura máxima (em linhas do grid do painel) exibida por página de TV. */
const MAX_ROWS = 10;
const SPEEDS = [20, 30, 45, 60, 90];
const SPEED_KEY = "dashboard.tv.speed";

/** Agrupa os widgets em páginas respeitando a posição/altura salvas no painel. */
function paginate(items: Placed[]): Placed[][] {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const pages: Placed[][] = [];
  let cur: Placed[] = [];
  let baseY = 0;
  for (const it of sorted) {
    const bottom = it.y + it.h;
    if (cur.length && bottom - baseY > MAX_ROWS) {
      pages.push(cur);
      cur = [];
      baseY = it.y;
    }
    if (!cur.length) baseY = it.y;
    cur.push(it);
  }
  if (cur.length) pages.push(cur);
  return pages;
}

function PainelTv() {
  const [selected, setSelected] = useState<string[]>([]);
  const [layout, setLayout] = useState<Placed[]>([]);
  const [page, setPage] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [segundos, setSegundos] = useState(30);
  const [filtros, setFiltros] = useState<DashboardFilters>(DEFAULT_FILTERS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("dashboard.ticker.v1");
      if (raw) setSelected(JSON.parse(raw) as string[]);
      const lay = localStorage.getItem("dashboard.layout.v1");
      if (lay) setLayout(JSON.parse(lay) as Placed[]);
      const sp = Number(localStorage.getItem(SPEED_KEY));
      if (SPEEDS.includes(sp)) setSegundos(sp);
      setFiltros(loadFilters());
    } catch {
      /* ignore */
    }
    // painel compartilhado (salvo pelo admin) prevalece
    fetchSharedDashboard().then((cfg) => {
      if (!cfg) return;
      if (Array.isArray(cfg.layout) && cfg.layout.length) setLayout(cfg.layout as Placed[]);
      if (Array.isArray(cfg.ticker)) setSelected(cfg.ticker);
    });
  }, []);


  const valid = useMemo(
    () =>
      layout.filter((p) => {
        const def = WIDGET_MAP.get(p.widgetId);
        return !!def && filtros.modules.includes(def.module);
      }),
    [layout, filtros.modules],
  );

  const pagesArr = useMemo(() => paginate(valid), [valid]);
  const pages = Math.max(1, pagesArr.length);

  useEffect(() => {
    if (!playing || pages <= 1) return;
    const t = setInterval(() => setPage((p) => (p + 1) % pages), segundos * 1000);
    return () => clearInterval(t);
  }, [playing, pages, segundos]);

  const cur = pagesArr[Math.min(page, pages - 1)] ?? [];
  const minY = cur.reduce((m, it) => Math.min(m, it.y), Infinity);
  const rows = Math.max(1, cur.reduce((m, it) => Math.max(m, it.y + it.h - minY), 1));

  return (
    <DashboardFilterContext.Provider value={filtros}>
    <div className="fixed inset-0 z-50 flex flex-col bg-background">

      <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-3">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Voltar ao painel
        </Link>
        <div className="text-center">
          <div className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Controle industrial</div>
          <div className="text-xl font-bold">Programação · Puncionadeira · Dobra</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground tabular-nums">
            {Math.min(page, pages - 1) + 1}/{pages}
          </span>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Troca a cada
            <select
              value={segundos}
              onChange={(e) => {
                const v = Number(e.target.value);
                setSegundos(v);
                try {
                  localStorage.setItem(SPEED_KEY, String(v));
                } catch {
                  /* ignore */
                }
              }}
              className="rounded-md border border-border bg-input px-2 py-1 text-xs text-foreground"
            >
              {SPEEDS.map((s) => (
                <option key={s} value={s}>
                  {s}s
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => setPage((p) => (p + 1) % pages)}
            className="rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-secondary"
          >
            Próxima
          </button>
          <button
            onClick={() => setPlaying((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-secondary"
          >
            {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
            {playing ? "Pausar" : "Retomar"}
          </button>
        </div>
      </header>

      <main className="min-h-0 flex-1 p-3">
        {cur.length === 0 ? (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">
            Nenhum widget no painel. Adicione widgets no Painel para exibi-los aqui.
          </div>
        ) : (
          <div key={page} className="relative h-full w-full animate-fade-in">
            {cur.map((p) => {
              const D = WIDGET_MAP.get(p.widgetId)!;
              const C = D.Component;
              return (
                <section
                  key={p.i}
                  className="absolute overflow-hidden rounded-lg border border-border bg-card shadow-sm"
                  style={{
                    left: `calc(${(p.x / COLS) * 100}% + 4px)`,
                    width: `calc(${(p.w / COLS) * 100}% - 8px)`,
                    top: `calc(${((p.y - minY) / rows) * 100}% + 4px)`,
                    height: `calc(${(p.h / rows) * 100}% - 8px)`,
                    borderLeft: `4px solid ${MODULE_ACCENT[D.module]}`,
                  }}
                >
                  <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1">
                    <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {D.title}
                    </span>
                    <span
                      className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
                      style={{
                        background: `color-mix(in oklab, ${MODULE_ACCENT[D.module]} 18%, transparent)`,
                        color: MODULE_ACCENT[D.module],
                      }}
                    >
                      {D.module}
                    </span>
                  </div>
                  <div className="h-[calc(100%-1.75rem)]">
                    <DashboardFilterContext.Provider value={{ ...filtros, dias: p.dias ?? 0 }}>
                      <C config={{ metrics: selected }} />
                    </DashboardFilterContext.Provider>
                  </div>

                </section>
              );
            })}
          </div>
        )}
      </main>

      <footer className="h-20 shrink-0 border-t border-border bg-card/70">
        <TickerPanel selected={selected} variant="tv" mode="marquee" speed={42} />
      </footer>
    </div>
    </DashboardFilterContext.Provider>

  );
}
