import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { TickerPanel } from "@/components/TickerPanel";
import { MODULE_ACCENT, WIDGET_MAP } from "@/components/widgets/registry";
import { ArrowLeft, Pause, Play } from "lucide-react";

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

const PER_PAGE = 6;
const PAGE_MS = 12000;

function PainelTv() {
  const [selected, setSelected] = useState<string[]>([]);
  const [layout, setLayout] = useState<Placed[]>([]);
  const [page, setPage] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("dashboard.ticker.v1");
      if (raw) setSelected(JSON.parse(raw) as string[]);
      const lay = localStorage.getItem("dashboard.layout.v1");
      if (lay) setLayout(JSON.parse(lay) as Placed[]);
    } catch {
      /* ignore */
    }
  }, []);

  const widgets = useMemo(
    () => layout.map((p) => ({ key: p.i, def: WIDGET_MAP.get(p.widgetId) })).filter((w) => w.def),
    [layout],
  );
  const pages = Math.max(1, Math.ceil(widgets.length / PER_PAGE));

  useEffect(() => {
    if (!playing || pages <= 1) return;
    const t = setInterval(() => setPage((p) => (p + 1) % pages), PAGE_MS);
    return () => clearInterval(t);
  }, [playing, pages]);

  const visible = widgets.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);

  return (
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
            {page + 1}/{pages}
          </span>
          <button
            onClick={() => setPlaying((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-secondary"
          >
            {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
            {playing ? "Pausar" : "Retomar"}
          </button>
        </div>
      </header>

      <main className="flex-1 min-h-0 p-4">
        {visible.length === 0 ? (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">
            Nenhum widget no painel. Adicione widgets no Painel para exibi-los aqui.
          </div>
        ) : (
          <div key={page} className="grid h-full animate-fade-in grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map(({ key, def }) => {
              const D = def!;
              const C = D.Component;
              return (
                <section
                  key={key}
                  className="min-h-0 overflow-hidden rounded-lg border border-border bg-card shadow-sm"
                  style={{ borderLeft: `4px solid ${MODULE_ACCENT[D.module]}` }}
                >
                  <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
                    <span className="truncate text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {D.title}
                    </span>
                    <span
                      className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
                      style={{ background: `color-mix(in oklab, ${MODULE_ACCENT[D.module]} 18%, transparent)`, color: MODULE_ACCENT[D.module] }}
                    >
                      {D.module}
                    </span>
                  </div>
                  <div className="h-[calc(100%-2.25rem)]">
                    <C config={{ metrics: selected }} />
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>

      <footer className="h-24 shrink-0 border-t border-border bg-card/70">
        <TickerPanel selected={selected} variant="tv" mode="marquee" speed={42} />
      </footer>
    </div>
  );
}
