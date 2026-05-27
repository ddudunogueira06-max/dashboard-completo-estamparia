import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "@/components/Dashboard";

export const Route = createFileRoute("/_app/")({
  head: () => ({
    meta: [
      { title: "Dashboard de Desperdícios" },
      { name: "description", content: "BI industrial para análise de desperdício de materiais." },
    ],
  }),
  component: Dashboard,
});
