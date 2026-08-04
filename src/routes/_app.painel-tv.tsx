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
        <TickerPanel selected={selected} intervalMs={8000} variant="tv" />
      </div>
    </div>
  );
}
