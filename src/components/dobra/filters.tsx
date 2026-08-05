import { useMemo, useState } from "react";
import { Filter, RotateCcw, X } from "lucide-react";
import { inputCls, Field } from "./ui";
import { normKey, type RgCalc, type Situacao } from "@/lib/dobra";

export interface DobraFilters {
  dataIni: string;
  dataFim: string;
  situacao: "" | Situacao | "atrasada";
  rg: string;
  fpp: string;
  cliente: string;
  produto: string;
  operador: string;
  maquina: string;
  tarefa: string;
}

export const EMPTY_FILTERS: DobraFilters = {
  dataIni: "",
  dataFim: "",
  situacao: "",
  rg: "",
  fpp: "",
  cliente: "",
  produto: "",
  operador: "",
  maquina: "",
  tarefa: "",
};

export const activeFilterCount = (f: DobraFilters) => Object.values(f).filter((v) => v !== "").length;

const has = (v: string | null, q: string) => (q ? normKey(v).includes(normKey(q)) : true);

/** dateField: qual data usar no intervalo (planejamento por padrão). */
export function applyFilters(
  rows: RgCalc[],
  f: DobraFilters,
  dateField: "data_planejamento" | "data_conclusao" = "data_planejamento",
): RgCalc[] {
  return rows.filter((r) => {
    const d = (r[dateField] ?? "").slice(0, 10);
    if (f.dataIni && (!d || d < f.dataIni)) return false;
    if (f.dataFim && (!d || d > f.dataFim)) return false;
    if (f.situacao === "atrasada" ? !r.atrasada : f.situacao && r.situacao !== f.situacao) return false;
    return (
      has(r.rg, f.rg) &&
      has(r.fpp, f.fpp) &&
      has(r.cliente, f.cliente) &&
      has(r.produto, f.produto) &&
      has(r.operador, f.operador) &&
      has(r.maquina_ativa, f.maquina) &&
      has(r.tarefa_desc, f.tarefa)
    );
  });
}

export function FiltersBar({
  filters,
  onChange,
  rows,
}: {
  filters: DobraFilters;
  onChange: (f: DobraFilters) => void;
  rows: RgCalc[];
}) {
  const [open, setOpen] = useState(false);
  const set = (patch: Partial<DobraFilters>) => onChange({ ...filters, ...patch });
  const count = activeFilterCount(filters);

  const opts = useMemo(() => {
    const uniq = (get: (r: RgCalc) => string | null) =>
      Array.from(new Set(rows.map(get).filter((v): v is string => !!v)))
        .sort()
        .slice(0, 300);
    return {
      clientes: uniq((r) => r.cliente),
      produtos: uniq((r) => r.produto),
      operadores: uniq((r) => r.operador),
      maquinas: uniq((r) => r.maquina_ativa),
      tarefas: uniq((r) => r.tarefa_desc),
    };
  }, [rows]);

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <input
            type="date"
            value={filters.dataIni}
            onChange={(e) => set({ dataIni: e.target.value })}
            className={inputCls + " w-auto"}
          />
          <span className="text-muted-foreground text-xs">até</span>
          <input
            type="date"
            value={filters.dataFim}
            onChange={(e) => set({ dataFim: e.target.value })}
            className={inputCls + " w-auto"}
          />
          <input
            placeholder="Buscar RG"
            value={filters.rg}
            onChange={(e) => set({ rg: e.target.value })}
            className={inputCls + " w-32"}
          />
          <input
            placeholder="Buscar FPP/FPG"
            value={filters.fpp}
            onChange={(e) => set({ fpp: e.target.value })}
            className={inputCls + " w-36"}
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {count > 0 && (
            <button
              onClick={() => onChange(EMPTY_FILTERS)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-secondary"
            >
              <RotateCcw className="size-3.5" /> Limpar
            </button>
          )}
          <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
          >
            {open ? <X className="size-3.5" /> : <Filter className="size-3.5" />} Filtros
            {count > 0 && (
              <span className="ml-1 rounded bg-accent px-1.5 text-[10px] text-accent-foreground">{count}</span>
            )}
          </button>
        </div>
      </div>
      {open && (
        <div className="grid gap-3 border-t border-border p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Situação">
            <select
              value={filters.situacao}
              onChange={(e) => set({ situacao: e.target.value as DobraFilters["situacao"] })}
              className={inputCls}
            >
              <option value="">Todas</option>
              <option value="em_producao">Em produção</option>
              <option value="disponivel">Disponível para dobrar</option>
              <option value="aguardando">Aguardando etapa anterior</option>
              <option value="concluida">Concluída</option>
              <option value="atrasada">Atrasadas</option>
            </select>
          </Field>
          {(
            [
              ["Cliente", "cliente", opts.clientes],
              ["Produto", "produto", opts.produtos],
              ["Operador", "operador", opts.operadores],
              ["Máquina", "maquina", opts.maquinas],
              ["Tarefa", "tarefa", opts.tarefas],
            ] as const
          ).map(([label, key, list]) => (
            <Field key={key} label={label}>
              <select value={filters[key]} onChange={(e) => set({ [key]: e.target.value })} className={inputCls}>
                <option value="">Todos</option>
                {list.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </Field>
          ))}
        </div>
      )}
    </div>
  );
}
