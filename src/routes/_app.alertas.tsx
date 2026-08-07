import { createFileRoute } from "@tanstack/react-router";
import { AlertsCenter } from "@/components/AlertsCenter";

export const Route = createFileRoute("/_app/alertas")({
  ssr: false,
  head: () => ({ meta: [
    { title: "Análises e Alertas — Controle Industrial" },
    { name: "description", content: "Alertas centralizados de Programação, Puncionadeira e Dobra." },
    { property: "og:title", content: "Análises e Alertas — Controle Industrial" },
    { property: "og:description", content: "Pontos de atenção centralizados da operação industrial." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AlertsCenter,
});