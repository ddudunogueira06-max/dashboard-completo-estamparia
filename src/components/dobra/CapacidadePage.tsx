import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Card, Field, inputCls } from "./ui";
import { useQueryClient } from "@tanstack/react-query";
import {
  capacidadeTotalSeg,
  saveSetting,
  secToHms,
  useDobraSettings,
  type Capacidade,
  type MetaParams,
} from "@/lib/dobra";
import { Save, Plus, X } from "lucide-react";

export function CapacidadePage({ readOnly }: { readOnly: boolean }) {
  const { data } = useDobraSettings();
  const qc = useQueryClient();
  const [cap, setCap] = useState<Capacidade | null>(null);
  const [meta, setMeta] = useState<MetaParams | null>(null);
  const [tarefas, setTarefas] = useState<string[]>([]);
  const [nova, setNova] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setCap(data.capacidade);
    setMeta(data.meta);
    setTarefas(data.tarefas);
  }, [data]);

  if (!cap || !meta) return <div className="p-6 text-sm text-muted-foreground">Carregando parâmetros...</div>;

  const total = capacidadeTotalSeg(cap);

  const salvar = async () => {
    setSaving(true);
    try {
      await Promise.all([
        saveSetting("capacidade", cap),
        saveSetting("meta", meta),
        saveSetting("tarefas_dobra", tarefas),
      ]);
      await qc.invalidateQueries({ queryKey: ["dobra_settings"] });
      toast.success("Parâmetros salvos.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar (apenas administradores).");
    } finally {
      setSaving(false);
    }
  };

  const num = (v: string) => Math.max(0, Number(v) || 0);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold truncate">Capacidade e parâmetros</h2>
          <p className="text-xs text-muted-foreground">
            Capacidade total calculada: <b className="text-accent tabular-nums">{secToHms(total)}</b>
          </p>
        </div>
        {!readOnly && (
          <button
            onClick={salvar}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            <Save className="size-4" /> {saving ? "Salvando..." : "Salvar"}
          </button>
        )}
      </div>

      <Card title="Dobra">
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Horas disponíveis do dia">
            <input className={inputCls} value={cap.horasDiaDobra} onChange={(e) => setCap({ ...cap, horasDiaDobra: e.target.value })} disabled={readOnly} />
          </Field>
          <Field label="Horas 1º turno">
            <input className={inputCls} value={cap.turno1} onChange={(e) => setCap({ ...cap, turno1: e.target.value })} disabled={readOnly} />
          </Field>
          <Field label="Horas 2º turno">
            <input className={inputCls} value={cap.turno2} onChange={(e) => setCap({ ...cap, turno2: e.target.value })} disabled={readOnly} />
          </Field>
          <Field label="Quantidade de dobradeiras">
            <input type="number" className={inputCls} value={cap.dobradeiras} onChange={(e) => setCap({ ...cap, dobradeiras: num(e.target.value) })} disabled={readOnly} />
          </Field>
          <Field label="Férias 1º turno">
            <input type="number" className={inputCls} value={cap.feriasT1} onChange={(e) => setCap({ ...cap, feriasT1: num(e.target.value) })} disabled={readOnly} />
          </Field>
          <Field label="Férias 2º turno">
            <input type="number" className={inputCls} value={cap.feriasT2} onChange={(e) => setCap({ ...cap, feriasT2: num(e.target.value) })} disabled={readOnly} />
          </Field>
          <Field label="Afastados 1º turno">
            <input type="number" className={inputCls} value={cap.afastadosT1} onChange={(e) => setCap({ ...cap, afastadosT1: num(e.target.value) })} disabled={readOnly} />
          </Field>
          <Field label="Afastados 2º turno">
            <input type="number" className={inputCls} value={cap.afastadosT2} onChange={(e) => setCap({ ...cap, afastadosT2: num(e.target.value) })} disabled={readOnly} />
          </Field>
          <Field label="Modo de cálculo">
            <select className={inputCls} value={cap.manual ? "manual" : "auto"} onChange={(e) => setCap({ ...cap, manual: e.target.value === "manual" })} disabled={readOnly}>
              <option value="auto">Calcular automaticamente</option>
              <option value="manual">Digitar capacidade total</option>
            </select>
          </Field>
          <Field label="Capacidade manual [h]:mm:ss">
            <input className={inputCls} value={cap.capacidadeManual} onChange={(e) => setCap({ ...cap, capacidadeManual: e.target.value })} disabled={readOnly || !cap.manual} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Observações">
              <input className={inputCls} value={cap.obs} onChange={(e) => setCap({ ...cap, obs: e.target.value })} disabled={readOnly} />
            </Field>
          </div>
        </div>
      </Card>

      <Card title="Meta e média de produção">
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Meta de RGs por dia">
            <input type="number" className={inputCls} value={meta.metaRgsDia} onChange={(e) => setMeta({ ...meta, metaRgsDia: num(e.target.value) })} disabled={readOnly} />
          </Field>
          <Field label="Período da média (dias)">
            <select className={inputCls} value={meta.periodoMedia} onChange={(e) => setMeta({ ...meta, periodoMedia: num(e.target.value) })} disabled={readOnly}>
              {[7, 15, 30, 60, 90].map((n) => (
                <option key={n} value={n}>Últimos {n} dias</option>
              ))}
            </select>
          </Field>
          <Field label="Meta de SLA (%)">
            <input type="number" className={inputCls} value={meta.metaSla} onChange={(e) => setMeta({ ...meta, metaSla: num(e.target.value) })} disabled={readOnly} />
          </Field>
          <Field label="Base de dias">
            <select
              className={inputCls}
              value={meta.somenteDiasComProducao ? "prod" : "uteis"}
              onChange={(e) => setMeta({ ...meta, somenteDiasComProducao: e.target.value === "prod" })}
              disabled={readOnly}
            >
              <option value="prod">Somente dias com produção</option>
              <option value="uteis">Todos os dias úteis</option>
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={meta.ignorarFimDeSemana}
              onChange={(e) => setMeta({ ...meta, ignorarFimDeSemana: e.target.checked })}
              disabled={readOnly}
            />
            Desconsiderar finais de semana
          </label>
        </div>
      </Card>

      <Card title="Tarefas consideradas dobra">
        <div className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {tarefas.map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1 text-xs">
                {t}
                {!readOnly && (
                  <button onClick={() => setTarefas(tarefas.filter((x) => x !== t))} className="text-muted-foreground hover:text-destructive">
                    <X className="size-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
          {!readOnly && (
            <div className="flex gap-2">
              <input className={inputCls + " max-w-xs"} placeholder="Nova descrição de tarefa" value={nova} onChange={(e) => setNova(e.target.value)} />
              <button
                onClick={() => {
                  const v = nova.trim();
                  if (v && !tarefas.includes(v)) setTarefas([...tarefas, v]);
                  setNova("");
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary"
              >
                <Plus className="size-4" /> Adicionar
              </button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
