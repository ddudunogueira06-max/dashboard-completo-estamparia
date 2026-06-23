import { createFileRoute } from "@tanstack/react-router";
import { OeeImportPage } from "@/components/OeeImportPage";

export const Route = createFileRoute("/_app/importar-oee")({
  head: () => ({
    meta: [
      { title: "Importar PDFs de OEE" },
      { name: "description", content: "Importação dos relatórios de OEE em PDF (paradas, horas registradas etc.)." },
    ],
  }),
  component: OeeImportPage,
});
