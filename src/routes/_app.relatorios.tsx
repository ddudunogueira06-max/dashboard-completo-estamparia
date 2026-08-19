import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FileDown, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  oeeAverage,
  prodByMachine,
  useOeeDias,
  useProduction,
  useWaste,
  wasteByMaterial,
  wasteTotalKg,
  wasteWeightedLoss,
} from "@/lib/dashboardData";
import { buildCargaDiaria, buildProducaoDiaria, buildRgCalc, capacidadeTotalSeg, fmtBrDate, secToHms, useDobraFpps, useDobraRgs, useDobraSettings } from "@/lib/dobra";
import { generateGeneralReportPDF, type ReportSection } from "@/lib/generalReport";

export const Route = createFileRoute("/_app/relatorios")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Relatórios — Controle Industrial" },
      { name: "description", content: "Relatório geral em PDF separado por aba: Programação, Puncionadeira e Dobra." },
      { property: "og:title", content: "Relatórios — Controle Industrial" },
      { property: "og:description", content: "Gere um PDF consolidado da produção separado por módulo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RelatoriosPage,
});

const COLORS: Record<string, [number, number, number]> = {
  "Programação": [0, 140, 170],
  Puncionadeira: [255, 120, 20],
  Dobra: [8, 32, 59],
};

function RelatoriosPage() {
  const waste = useWaste();
  const prod = useProduction();
  const oee = useOeeDias();
  const rgs = useDobraRgs();
  const fpps = useDobraFpps();
  const settings = useDobraSettings();
  const [abas, setAbas] = useState<string[]>(["Programação", "Puncionadeira", "Dobra"]);

  const loading = waste.isLoading || prod.isLoading || oee.isLoading || rgs.isLoading || fpps.isLoading;

  const sections = useMemo<ReportSection[]>(() => {
    const out: ReportSection[] = [];
    const w = waste.data ?? [];
    const p = prod.data ?? [];
    const o = oee.data ?? [];
    const dobra = buildRgCalc(rgs.data ?? [], fpps.data ?? [], settings.data?.tarefas ?? [], settings.data?.ajuste);

    if (abas.includes("Programação")) {
      out.push({
        module: "Programação",
        title: "Desperdícios e produção programada",
        color: COLORS["Programação"]!,
        kpis: [
          { label: "Perda média", value: `${wasteWeightedLoss(w).toFixed(1)}%` },
          { label: "Peso total", value: `${wasteTotalKg(w).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} kg` },
          { label: "Registros", value: String(w.length) },
          { label: "Programações", value: String(p.length) },
        ],
        columns: ["Material", "Peso (kg)"],
        rows: wasteByMaterial(w).map((r) => [r.name, Math.round(r.value).toLocaleString("pt-BR")]),
      });
      out.push({
        module: "Programação",
        title: "Produção por máquina",
        color: COLORS["Programação"]!,
        kpis: [],
        columns: ["Máquina", "Peças", "Horas"],
        rows: prodByMachine(p).map((r) => [r.label, r.pecas.toLocaleString("pt-BR"), r.horas.toFixed(1)]),
      });
    }

    if (abas.includes("Puncionadeira")) {
      out.push({
        module: "Puncionadeira",
        title: "OEE por dia",
        color: COLORS["Puncionadeira"]!,
        kpis: [
          { label: "OEE médio", value: `${oeeAverage(o).toFixed(1)}%` },
          { label: "Dias avaliados", value: String(o.length) },
          { label: "Dias abaixo de 85%", value: String(o.filter((r) => (r.oee ?? 0) < 85).length) },
        ],
        columns: ["Data", "Turno", "Máquina", "OEE (%)"],
        rows: [...o]
          .sort((a, b) => (b.data ?? "").localeCompare(a.data ?? ""))
          .slice(0, 120)
          .map((r) => [fmtBrDate(r.data ?? ""), String(r.turno ?? "—"), String(r.maquina ?? "—"), (r.oee ?? 0).toFixed(1)]),
      });
    }

    if (abas.includes("Dobra")) {
      const abertas = dobra.filter((r) => !isDobrada(r.situacao));
      const concluidas = dobra.filter((r) => isDobrada(r.situacao));
      const capSeg = capacidadeTotalSeg(settings.data?.capacidade ?? ({} as never));
      out.push({
        module: "Dobra",
        title: "Situação das RGs em aberto",
        color: COLORS["Dobra"]!,
        kpis: [
          { label: "Em aberto", value: String(abertas.length) },
          { label: "Atrasadas", value: String(abertas.filter((r) => r.atrasada).length) },
          { label: "Concluídas", value: String(concluidas.length) },
          { label: "Horas em aberto", value: secToHms(abertas.reduce((s, r) => s + r.tempoEstimadoSeg, 0)) },
        ],
        columns: ["RG", "FPP", "Cliente", "Produto", "Situação", "Planejamento", "Tempo estimado"],
        rows: abertas
          .slice(0, 200)
          .map((r) => [r.rg, r.fpp ?? "—", r.cliente ?? "—", r.produto ?? "—", r.situacao, fmtBrDate(r.data_planejamento ?? ""), secToHms(r.tempoEstimadoSeg)]),
      });
      out.push({
        module: "Dobra",
        title: "Produção diária e carga prevista",
        color: COLORS["Dobra"]!,
        kpis: [],
        columns: ["Dia", "RGs concluídas", "Horas produzidas", "Carga prevista (h)", "Capacidade (h)"],
        rows: (() => {
          const prodDias = buildProducaoDiaria(concluidas);
          const carga = buildCargaDiaria(abertas, capSeg);
          const labels = Array.from(new Set([...prodDias.map((d) => d.label), ...carga.map((c) => c.label)]));
          return labels.map((l) => {
            const pd = prodDias.find((d) => d.label === l);
            const cg = carga.find((c) => c.label === l);
            return [l, String(pd?.rgs ?? 0), String(pd?.horas ?? 0), String(cg?.horas ?? 0), String(cg?.capacidade ?? 0)];
          });
        })(),
      });
    }

    return out;
  }, [abas, waste.data, prod.data, oee.data, rgs.data, fpps.data, settings.data]);

  const toggle = (m: string) => setAbas((a) => (a.includes(m) ? a.filter((x) => x !== m) : [...a, m]));

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <FileText className="size-6 text-primary" /> Relatórios
        </h1>
        <p className="text-sm text-muted-foreground">
          Relatório geral em PDF, com uma aba por módulo: indicadores no topo e tabela detalhada abaixo.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <div>
          <div className="text-sm font-medium">Abas incluídas</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {["Programação", "Puncionadeira", "Dobra"].map((m) => (
              <button
                key={m}
                onClick={() => toggle(m)}
                className={`rounded-md border px-3 py-1.5 text-sm ${
                  abas.includes(m) ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-secondary"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <ul className="space-y-1 text-sm text-muted-foreground">
          {sections.map((s) => (
            <li key={`${s.module}-${s.title}`}>
              <span className="font-medium text-foreground">{s.module}</span> — {s.title} ({s.rows.length} linhas)
            </li>
          ))}
          {sections.length === 0 && <li>Selecione pelo menos um módulo.</li>}
        </ul>

        <button
          disabled={loading || sections.length === 0}
          onClick={() => {
            try {
              generateGeneralReportPDF(sections, "Todos os dados importados");
              toast.success("Relatório gerado.");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Falha ao gerar o relatório.");
            }
          }}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          <FileDown className="size-4" /> {loading ? "Carregando dados..." : "Gerar PDF geral"}
        </button>
      </div>
    </div>
  );
}
