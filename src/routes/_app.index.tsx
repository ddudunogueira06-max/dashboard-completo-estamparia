import { createFileRoute } from "@tanstack/react-router";
import { ModularDashboard } from "@/components/ModularDashboard";

export const Route = createFileRoute("/_app/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Painel Modular — Controle Industrial" },
      { name: "description", content: "Dashboard modular com widgets de Programação, Puncionadeira e Dobra." },
      { property: "og:title", content: "Painel Modular — Controle Industrial" },
      { property: "og:description", content: "Widgets arrastáveis e redimensionáveis para acompanhar a produção." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ModularDashboard,
});
