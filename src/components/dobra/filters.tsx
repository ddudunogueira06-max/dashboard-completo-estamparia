import { useId, useMemo, useState } from "react";
import { Filter, RotateCcw, X } from "lucide-react";
import { inputCls, Field } from "./ui";
import { isDobrada, normKey, tipoCode, type RgCalc, type Situacao } from "@/lib/dobra";

export interface DobraFilters {
  dataIni: string;
  dataFim: string;
  situacao: "" | Situacao | "atrasada" | "dobrada";
  rg: string;
  fpp: string;
  tipo: string;
  ov: string;
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
  tipo: "",
  ov: "",
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
  dateField: "data_planejamento" | "data_conclusao" | "data_dobra" = "data_planejamento",
): RgCalc[] {
  return rows.filter((r) => {
    const d = (r[dateField] ?? "").slice(0, 10);
    if (f.dataIni && (!d || d < f.dataIni)) return false;
    if (f.dataFim && (!d || d > f.dataFim)) return false;
    if (f.situacao === "atrasada") {
      if (!r.atrasada) return false;
    } else if (f.situacao === "dobrada") {
      if (!isDobrada(r.situacao)) return false;
    } else if (f.situacao && r.situacao !== f.situacao) return false;
    if (f.tipo && tipoCode(r.fpp) !== f.tipo) return false;
    return (
      has(r.rg, f.rg) &&
      has(r.fpp, f.fpp) &&
      has(r.nr_ov, f.ov) &&
      has(r.cliente, f.cliente) &&
      has(r.produto, f.produto) &&
      has(r.operador, f.operador) &&
      has(r.maquina_ativa, f.maquina) &&
      has(r.tarefa_desc, f.tarefa)
    );
  });
}

/** Campo de seleção com busca (input + datalist) para listas grandes. */
function SearchSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}) {
  const id = useId();
  return (
    <div className="relative">
      <input
        list={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputCls + " pr-6"}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
          aria-label="Limpar"
        >
          <X className="size-3.5" />
        </button>
      )}
      <datalist id={id}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </div>
  );
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
      Array.from(new Set(rows.map(get).filter((v): v is string => !!v))).sort();
    return {
      clientes: uniq((r) => r.cliente),
      produtos: uniq((r) => r.produto),
      operadores: uniq((r) => r.operador),
      maquinas: uniq((r) => r.maquina_ativa),
      tarefas: uniq((r) => r.tarefa_desc),
      tipos: Array.from(new Set(rows.map((r) => tipoCode(r.fpp)).filter(Boolean))).sort(),
    };
  }, [rows]);

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <div className="inline-flex items-center rounded-md border border-input bg-background px-1.5">
            <input
              type="date"
              aria-label="Data inicial"
              value={filters.dataIni}
              onChange={(e) => set({ dataIni: e.target.value })}
              className="h-7 w-[7.5rem] bg-transparent text-xs outline-none"
            />
            <span className="px-1 text-xs text-muted-foreground">–</span>
            <input
              type="date"
              aria-label="Data final"
              value={filters.dataFim}
              onChange={(e) => set({ dataFim: e.target.value })}
              className="h-7 w-[7.5rem] bg-transparent text-xs outline-none"
            />
          </div>
          <input
            placeholder="RG"
            value={filters.rg}
            onChange={(e) => set({ rg: e.target.value })}
            className="h-7 w-24 rounded-md border border-border bg-input px-2 text-xs outline-none focus:ring-2 focus:ring-ring/40"
          />
          <input
            placeholder="FPP/FPG"
            value={filters.fpp}
            onChange={(e) => set({ fpp: e.target.value })}
            className="h-7 w-28 rounded-md border border-border bg-input px-2 text-xs outline-none focus:ring-2 focus:ring-ring/40"
          />
          <input
            placeholder="Nr. OV"
            value={filters.ov}
            onChange={(e) => set({ ov: e.target.value })}
            className="h-7 w-24 rounded-md border border-border bg-input px-2 text-xs outline-none focus:ring-2 focus:ring-ring/40"
          />
          <select
            value={filters.tipo}
            onChange={(e) => set({ tipo: e.target.value })}
            className="h-7 w-24 rounded-md border border-border bg-input px-1.5 text-xs outline-none"
            aria-label="Tipo de pacote"
          >
            <option value="">Tipo</option>
            {opts.tipos.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            value={filters.situacao}
            onChange={(e) => set({ situacao: e.target.value as DobraFilters["situacao"] })}
            className="h-7 w-40 rounded-md border border-border bg-input px-1.5 text-xs outline-none"
            aria-label="Situação"
          >
            <option value="">Situação: todas</option>
            <option value="em_producao">Em produção</option>
            <option value="disponivel">Disponível para dobrar</option>
            <option value="aguardando">Aguardando etapa anterior</option>
            <option value="logistica">Logística interna</option>
            <option value="separacao">Em separação</option>
            <option value="concluida">Concluída</option>
            <option value="dobrada">Já dobradas</option>
            <option value="atrasada">Atrasadas</option>
          </select>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {count > 0 && (
            <button
              onClick={() => onChange(EMPTY_FILTERS)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-secondary"
            >
              <RotateCcw className="size-3.5" /> Limpar
            </button>
          )}
          <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-secondary"
          >
            {open ? <X className="size-3.5" /> : <Filter className="size-3.5" />} Mais filtros
            {count > 0 && (
              <span className="ml-1 rounded bg-accent px-1.5 text-[10px] text-accent-foreground">{count}</span>
            )}
          </button>
        </div>
      </div>
      {open && (
        <div className="grid gap-3 border-t border-border p-3 sm:grid-cols-2 lg:grid-cols-5">
          {(
            [
              ["Cliente", "cliente", opts.clientes],
              ["Produto", "produto", opts.produtos],
              ["Operador", "operador", opts.operadores],
              ["Máquina", "maquina", opts.maquinas],
              ["Tarefa", "tarefa", opts.tarefas],
            ] as const
          ).map(([label, key, list]) => (
            <Field key={key} label={`${label} (${list.length})`}>
              <SearchSelect
                value={filters[key]}
                onChange={(v) => set({ [key]: v })}
                options={list}
                placeholder={`Pesquisar ${label.toLowerCase()}...`}
              />
            </Field>
          ))}
        </div>
      )}
    </div>
  );
}
