import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ModuleTabs } from "@/components/ModuleTabs";
import { useAuth } from "@/hooks/useAuth";
import { FoldHorizontal, Upload } from "lucide-react";

export const Route = createFileRoute("/_app/dobra")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Dobra — Controle Industrial" },
      { name: "description", content: "Módulo de dobra: indicadores e importação de dados do setor." },
      { property: "og:title", content: "Dobra — Controle Industrial" },
      { property: "og:description", content: "Indicadores e importação de dados do setor de dobra." },
    ],
  }),
  component: DobraModule,
});

function DobraModule() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState("painel");

  const tabs = [
    { id: "painel", label: "Painel" },
    ...(isAdmin ? [{ id: "importar", label: "Importar Dobra" }] : []),
  ];

  return (
    <div>
      <ModuleTabs title="Dobra" tabs={tabs} active={tab} onChange={setTab} />
      <div className="p-6">
        {tab === "painel" && (
          <div className="border border-dashed border-border rounded-xl p-12 text-center">
            <FoldHorizontal className="size-10 mx-auto text-muted-foreground mb-3" />
            <h2 className="font-semibold mb-1">Módulo de Dobra em preparação</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              A estrutura está pronta. Assim que você definir a planilha e os indicadores da dobra, os
              gráficos aparecerão aqui e também ficarão disponíveis como widgets no Painel.
            </p>
          </div>
        )}
        {tab === "importar" && isAdmin && (
          <div className="border border-dashed border-border rounded-xl p-12 text-center">
            <Upload className="size-10 mx-auto text-muted-foreground mb-3" />
            <h2 className="font-semibold mb-1">Importação de Dobra</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Envie um exemplo da planilha de dobra e eu configuro a leitura das colunas nesta área.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
