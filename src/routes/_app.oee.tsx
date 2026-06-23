import { createFileRoute } from "@tanstack/react-router";
import { OeeDashboard } from "@/components/OeeDashboard";

export const Route = createFileRoute("/_app/oee")({
  head: () => ({
    meta: [
      { title: "OEE & Capacidade Real" },
      { name: "description", content: "Capacidade real por máquina e tempo de paradas a partir dos PDFs de OEE." },
    ],
  }),
  component: OeeDashboard,
});
