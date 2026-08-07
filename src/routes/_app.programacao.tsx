import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Dashboard } from "@/components/Dashboard";
import { ProductionDashboard } from "@/components/ProductionDashboard";
import { ProductsDashboard } from "@/components/ProductsDashboard";
import { ImportPage } from "@/components/ImportPage";
import { ProductionImportPage } from "@/components/ProductionImportPage";
import { ModuleTabs } from "@/components/ModuleTabs";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_app/programacao")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Programação — Controle Industrial" },
      { name: "description", content: "Desperdícios, produção, produtos e importação do setor de programação." },
      { property: "og:title", content: "Programação — Controle Industrial" },
      { property: "og:description", content: "Painéis e importação de dados do setor de programação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProgramacaoModule,
});

function ProgramacaoModule() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState("desperdicios");

  const tabs = [
    { id: "desperdicios", label: "Desperdícios" },
    { id: "producao", label: "Produção" },
    { id: "produtos", label: "Produtos" },
    ...(isAdmin
      ? [
          { id: "importar-desperdicio", label: "Importar Desperdício" },
          { id: "importar-producao", label: "Importar Produção" },
        ]
      : []),
  ];

  return (
    <div>
      <ModuleTabs title="Programação" tabs={tabs} active={tab} onChange={setTab} />
      {tab === "desperdicios" && <Dashboard />}
      {tab === "producao" && <ProductionDashboard />}
      {tab === "produtos" && <ProductsDashboard />}
      {tab === "importar-desperdicio" && isAdmin && <ImportPage />}
      {tab === "importar-producao" && isAdmin && <ProductionImportPage />}
    </div>
  );
}
