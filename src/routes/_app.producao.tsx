import { createFileRoute } from "@tanstack/react-router";
import { ProductionDashboard } from "@/components/ProductionDashboard";

export const Route = createFileRoute("/_app/producao")({
  head: () => ({
    meta: [
      { title: "Painel de Produção" },
      { name: "description", content: "Capacidade, atravessamento e tempos do setor de programação." },
    ],
  }),
  component: ProductionDashboard,
});
