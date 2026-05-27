import { createFileRoute } from "@tanstack/react-router";
import { ImportPage } from "@/components/ImportPage";

export const Route = createFileRoute("/_app/importar")({
  head: () => ({
    meta: [
      { title: "Importar Planilha" },
      { name: "description", content: "Importação diária de planilhas Excel para o dashboard." },
    ],
  }),
  component: ImportPage,
});
