import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TickerPanel } from "@/components/TickerPanel";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_app/painel-tv")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Modo TV — Painel Rotativo" },
      { name: "description", content: "Exibição em tela cheia dos indicadores selecionados, em rotação automática." },
      { property: "og:title", content: "Modo TV — Painel Rotativo" },
      { property: "og:description", content: "Indicadores em rotação automática para exibição em TV." },
    ],
  }),
  component: PainelTv,
});

function PainelTv() {
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("dashboard.ticker.v1");
      if (raw) setSelected(JSON.parse(raw) as string[]);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="p-4">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Voltar ao painel
        </Link>
      </div>
      <div className="flex-1 min-h-0">
        <div className="h-full flex flex-col justify-center gap-12 overflow-hidden">
          <div className="text-center animate-fade-in">
            <div className="text-sm uppercase text-muted-foreground">Controle industrial em tempo real</div>
            <div className="mt-3 text-5xl font-bold">Programação · Puncionadeira · Dobra</div>
          </div>
          <div className="h-36 border-y border-border bg-card/70 shadow-sm">
            <TickerPanel selected={selected} variant="tv" mode="marquee" speed={42} />
          </div>
        </div>
      </div>
    </div>
  );
}
