import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { OeeDashboard } from "@/components/OeeDashboard";
import { OeeImportPage } from "@/components/OeeImportPage";
import { ModuleTabs } from "@/components/ModuleTabs";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_app/puncionadeira")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Puncionadeira — OEE e Paradas" },
      { name: "description", content: "OEE, capacidade e paradas das puncionadeiras, com importação de relatórios." },
      { property: "og:title", content: "Puncionadeira — OEE e Paradas" },
      { property: "og:description", content: "Acompanhe OEE, capacidade e paradas das puncionadeiras." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PuncionadeiraModule,
});

function PuncionadeiraModule() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState("oee");

  const tabs = [
    { id: "oee", label: "OEE" },
    ...(isAdmin ? [{ id: "importar", label: "Importar OEE" }] : []),
  ];

  return (
    <div>
      <ModuleTabs title="Puncionadeira" tabs={tabs} active={tab} onChange={setTab} />
      {tab === "oee" && <OeeDashboard />}
      {tab === "importar" && isAdmin && <OeeImportPage />}
    </div>
  );
}
