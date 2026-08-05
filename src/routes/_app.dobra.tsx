import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ModuleTabs } from "@/components/ModuleTabs";
import { useAuth } from "@/hooks/useAuth";
import { DobraDashboard } from "@/components/dobra/DobraDashboard";
import { EmAbertoTable } from "@/components/dobra/EmAbertoTable";
import { ConcluidasTable } from "@/components/dobra/ConcluidasTable";
import { ControleGeralRgs } from "@/components/dobra/ControleGeralRgs";
import { FppsPage } from "@/components/dobra/FppsPage";
import { CapacidadePage } from "@/components/dobra/CapacidadePage";
import { DobraImportPage } from "@/components/dobra/DobraImportPage";
import { Card } from "@/components/dobra/ui";
import { FiltersBar, applyFilters, EMPTY_FILTERS, type DobraFilters } from "@/components/dobra/filters";
import { buildRgCalc, useDobraFpps, useDobraRgs, useDobraSettings } from "@/lib/dobra";

export const Route = createFileRoute("/_app/dobra")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Dobra — Controle Industrial" },
      { name: "description", content: "Painel da dobra: SLA, RGs em aberto, capacidade e importação de dados." },
      { property: "og:title", content: "Dobra — Controle Industrial" },
      { property: "og:description", content: "SLA, RGs em aberto, capacidade e importação do setor de dobra." },
    ],
  }),
  component: DobraModule,
});

function DobraModule() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState("dashboard");
  const [filters, setFilters] = useState<DobraFilters>(EMPTY_FILTERS);

  const { data: rgs } = useDobraRgs();
  const { data: fpps } = useDobraFpps();
  const { data: settings } = useDobraSettings();

  const rows = useMemo(
    () => buildRgCalc(rgs ?? [], fpps ?? [], settings?.tarefas ?? []),
    [rgs, fpps, settings],
  );

  const tabs = [
    { id: "dashboard", label: "Dashboard" },
    { id: "aberto", label: "Dobra em aberto" },
    { id: "concluidas", label: "RGs concluídas" },
    { id: "controle", label: "Controle geral" },
    { id: "fpps", label: "FPPs" },
    { id: "capacidade", label: "Capacidade" },
    ...(isAdmin ? [{ id: "importar", label: "Importar Dobra" }] : []),
  ];

  const abertas = useMemo(() => applyFilters(rows, filters).filter((r) => r.situacao !== "concluida"), [rows, filters]);
  const concluidas = useMemo(
    () => applyFilters(rows.filter((r) => r.situacao === "concluida"), filters, "data_conclusao"),
    [rows, filters],
  );

  return (
    <div>
      <ModuleTabs title="Dobra" tabs={tabs} active={tab} onChange={setTab} />
      <div className="p-4 md:p-6 space-y-4">
        {tab !== "importar" && tab !== "capacidade" && tab !== "controle" && tab !== "fpps" && (
          <FiltersBar filters={filters} onChange={setFilters} rows={rows} />
        )}

        {tab === "dashboard" && settings && (
          <DobraDashboard
            rows={rows}
            filters={filters}
            capacidade={settings.capacidade}
            meta={settings.meta}
            onVerTodas={setTab}
          />
        )}
        {tab === "aberto" && (
          <Card title={`Dobra — Em aberto (${abertas.length})`}>
            <EmAbertoTable rows={abertas} pageSize={25} />
          </Card>
        )}
        {tab === "concluidas" && (
          <Card title={`RGs concluídas (${concluidas.length})`}>
            <ConcluidasTable rows={concluidas} pageSize={25} />
          </Card>
        )}
      </div>

      {tab === "controle" && <ControleGeralRgs rows={rows} filters={filters} onFilters={setFilters} />}
      {tab === "fpps" && <FppsPage rows={rows} fpps={fpps ?? []} filters={filters} onFilters={setFilters} />}
      {tab === "capacidade" && <CapacidadePage readOnly={!isAdmin} />}
      {tab === "importar" && isAdmin && <DobraImportPage />}
    </div>
  );
}
