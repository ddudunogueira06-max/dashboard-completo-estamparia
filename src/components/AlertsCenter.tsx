import { AlertTriangle, CheckCircle2, Factory, Gauge, Package } from "lucide-react";
import { useMemo } from "react";
import { buildRgCalc, useDobraFpps, useDobraRgs, useDobraSettings } from "@/lib/dobra";
import { oeeAverage, useOeeDias, useProduction, useWaste, wasteWeightedLoss } from "@/lib/dashboardData";

export function AlertsCenter() {
  const waste = useWaste();
  const production = useProduction();
  const oee = useOeeDias();
  const rgs = useDobraRgs();
  const fpps = useDobraFpps();
  const settings = useDobraSettings();
  const dobra = useMemo(() => buildRgCalc(rgs.data ?? [], fpps.data ?? [], settings.data?.tarefas ?? []), [rgs.data, fpps.data, settings.data]);
  const alerts = [
    { module: "Dobra", icon: Gauge, tone: "border-mod-dobra", label: "RGs atrasadas", value: dobra.filter((r) => r.atrasada).length, detail: "Planejamento vencido e produção ainda aberta" },
    { module: "Dobra", icon: Gauge, tone: "border-mod-dobra", label: "RGs sem tempo", value: dobra.filter((r) => r.situacao !== "concluida" && !r.tempoEstimadoSeg).length, detail: "Pacote sem tempo estimado ou sem vínculo" },
    { module: "Puncionadeira", icon: Factory, tone: "border-mod-puncionadeira", label: "OEE abaixo de 85%", value: (oee.data ?? []).filter((r) => (r.oee ?? 0) < 85).length, detail: `Média atual ${oeeAverage(oee.data ?? []).toFixed(1)}%` },
    { module: "Programação", icon: Package, tone: "border-mod-programacao", label: "Registros sem data", value: (production.data ?? []).filter((r) => !r.dt_prog && !r.data_rg).length, detail: "Não aparecem nas análises por período" },
    { module: "Programação", icon: Package, tone: "border-mod-programacao", label: "Perda média", value: Number(wasteWeightedLoss(waste.data ?? []).toFixed(1)), suffix: "%", detail: "Média ponderada dos registros importados" },
  ];
  const loading = waste.isLoading || production.isLoading || oee.isLoading || rgs.isLoading || fpps.isLoading;
  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><AlertTriangle className="size-6 text-warning" /> Análises e alertas</h1>
        <p className="text-sm text-muted-foreground">Visão central dos pontos que exigem atenção nos três módulos.</p>
      </div>
      {loading ? <div className="py-20 text-center text-sm text-muted-foreground">Analisando dados...</div> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {alerts.map((a) => {
            const Icon = a.icon;
            return <article key={`${a.module}-${a.label}`} className={`border-l-4 ${a.tone} rounded-md border-y border-r border-border bg-card p-4`}>
              <div className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground"><Icon className="size-4" />{a.module}</span><span className="text-2xl font-bold tabular-nums">{a.value}{a.suffix}</span></div>
              <div className="mt-3 font-medium">{a.label}</div><div className="text-xs text-muted-foreground">{a.detail}</div>
            </article>;
          })}
        </div>
      )}
      {!loading && alerts.every((a) => a.value === 0) && <div className="flex items-center gap-2 text-success"><CheckCircle2 className="size-5" /> Nenhum alerta ativo.</div>}
    </div>
  );
}