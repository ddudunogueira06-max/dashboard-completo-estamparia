import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Card, Field, inputCls } from "./ui";
import { useQueryClient } from "@tanstack/react-query";
import {
  capacidadeTotalSeg,
  normKey,
  saveSetting,
  secToHms,
  useDobraRgs,
  useDobraSettings,
  DEFAULT_AJUSTE,
  DIFICULDADE_FATOR,
  type AjusteDobra,
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
  const [ajuste, setAjuste] = useState<AjusteDobra>(DEFAULT_AJUSTE);
  const [buscaProduto, setBuscaProduto] = useState("");
  const { data: rgs } = useDobraRgs();
  const [saving, setSaving] = useState(false);
  const [slaMensal, setSlaMensal] = useState<Record<string, number>>({});
  const [slaMes, setSlaMes] = useState(() => new Date().toISOString().slice(0, 7));

  useEffect(() => {
    if (!data) return;
    setCap(data.capacidade);
    setMeta(data.meta);
    setTarefas(data.tarefas);
    setAjuste(data.ajuste ?? DEFAULT_AJUSTE);
    setSlaMensal(data.slaMensal ?? {});
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
        saveSetting("ajuste_dobra", ajuste),
        saveSetting(
          "sla_mensal",
          Object.fromEntries(Object.entries(slaMensal).filter(([, v]) => typeof v === "number" && !Number.isNaN(v))),
        ),
      ]);
      await qc.invalidateQueries({ queryKey: ["dobra_settings"] });
      toast.success("Parâmetros salvos.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar (apenas administradores).");
    } finally {
      setSaving(false);
    }
  };

  const produtos = Array.from(
    new Map((rgs ?? []).filter((r) => r.produto).map((r) => [normKey(r.produto), r.produto as string])).entries(),
  ).sort((a, b) => a[1].localeCompare(b[1]));
  const produtosFiltrados = produtos.filter(([, nome]) => nome.toLowerCase().includes(buscaProduto.toLowerCase())).slice(0, 200);

  const setDificuldade = (key: string, nivel: number) =>
    setAjuste({ ...ajuste, dificuldade: { ...ajuste.dificuldade, [key]: nivel } });

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

      <Card title="SLA oficial da planilha">
        <div className="grid gap-3 p-4 sm:grid-cols-3">
          <Field label="Mês de referência">
            <input type="month" className={inputCls} value={slaMes} onChange={(e) => setSlaMes(e.target.value)} disabled={readOnly} />
          </Field>
          <Field label="SLA (%)">
            <input
              type="number"
              step="0.01"
              className={inputCls}
              value={slaMensal[slaMes] ?? ""}
              placeholder="ex.: 95,68"
              onChange={(e) =>
                setSlaMensal({ ...slaMensal, [slaMes]: e.target.value === "" ? (undefined as unknown as number) : Number(e.target.value) })
              }
              disabled={readOnly}
            />
          </Field>
          <div className="self-end text-xs text-muted-foreground">
            Valor apresentado no card e no widget de SLA para esse mês. É preenchido automaticamente na importação (aba
            BD-CONTROLE-RG) e pode ser corrigido aqui.
          </div>
        </div>
      </Card>

      <Card title="Ajuste de tempo da dobra">
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Acréscimo sobre o tempo estimado (%)">
            <input
              type="number"
              className={inputCls}
              value={ajuste.fatorPct}
              onChange={(e) => setAjuste({ ...ajuste, fatorPct: Number(e.target.value) || 0 })}
              disabled={readOnly}
            />
          </Field>
          <div className="sm:col-span-3 self-end text-xs text-muted-foreground">
            O tempo de cada RG é o tempo do pacote dividido pelas RGs, acrescido de {ajuste.fatorPct}% e multiplicado pelo fator
            de dificuldade do produto (3 = normal).
          </div>
        </div>
      </Card>

      <Card title="Dificuldade de dobra por produto">
        <div className="p-4 space-y-3">
          <input
            className={inputCls + " max-w-xs"}
            placeholder="Buscar produto"
            value={buscaProduto}
            onChange={(e) => setBuscaProduto(e.target.value)}
          />
          {produtos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Importe as RGs da dobra para listar os produtos.</p>
          ) : (
            <div className="max-h-80 overflow-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-secondary text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Produto</th>
                    <th className="px-3 py-2 text-left font-medium w-52">Dificuldade</th>
                    <th className="px-3 py-2 text-right font-medium w-28">Fator</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {produtosFiltrados.map(([key, nome]) => {
                    const nivel = ajuste.dificuldade[key] ?? 3;
                    return (
                      <tr key={key}>
                        <td className="px-3 py-1.5 truncate">{nome}</td>
                        <td className="px-3 py-1.5">
                          <select
                            className={inputCls}
                            value={nivel}
                            onChange={(e) => setDificuldade(key, Number(e.target.value))}
                            disabled={readOnly}
                          >
                            <option value={1}>1 — Muito fácil</option>
                            <option value={2}>2 — Fácil</option>
                            <option value={3}>3 — Normal</option>
                            <option value={4}>4 — Difícil</option>
                            <option value={5}>5 — Muito difícil</option>
                          </select>
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{(DIFICULDADE_FATOR[nivel] ?? 1).toFixed(2)}x</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
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
