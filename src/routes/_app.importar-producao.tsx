import { createFileRoute } from "@tanstack/react-router";
import { ProductionImportPage } from "@/components/ProductionImportPage";

export const Route = createFileRoute("/_app/importar-producao")({
  head: () => ({
    meta: [
      { title: "Importar Planilha de Produção" },
      { name: "description", content: "Importação da planilha de produção e capacidade." },
    ],
  }),
  component: ProductionImportPage,
});
