import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fmtInt, fmtNum } from "@/lib/format";
import { Package, Merge, Pencil, Search, RefreshCw, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

interface ProdRow {
  fpp: string | null;
  produto: string | null;
  dt_prog: string | null;
  data_rg: string | null;
  tempo_fpp_seg: number | null;
  maquina: number | null;
}
interface Alias { raw_name: string; canonical_name: string }
interface Category { canonical_name: string; difficulty: number; notes: string | null }

async function fetchProdMinimal(): Promise<ProdRow[]> {
  const pageSize = 1000;
  let from = 0;
  const all: ProdRow[] = [];
  while (true) {
    const { data, error } = await supabase.from("production_records")
      .select("fpp, produto, dt_prog, data_rg, tempo_fpp_seg, maquina")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as ProdRow[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

function parseLocalDate(v: string | null): Date | null {
  if (!v) return null;
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}
function ymd(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function normalize(s: string) {
  return s.trim().toUpperCase().replace(/\s+/g, " ");
}

const DIFFICULTY_LABEL: Record<number, string> = {
  1: "1° · Muito fácil",
  2: "2° · Fácil",
  3: "3° · Médio",
  4: "4° · Difícil",
  5: "5° · Muito difícil",
};
const DIFFICULTY_COLOR: Record<number, string> = {
  1: "bg-success/15 text-success border-success/30",
  2: "bg-success/10 text-success border-success/20",
  3: "bg-warning/10 text-warning border-warning/30",
  4: "bg-destructive/10 text-destructive border-destructive/30",
  5: "bg-destructive/20 text-destructive border-destructive/50",
};

export function ProductsDashboard() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("");
  const [editing, setEditing] = useState<null | { canonical: string; difficulty: number; notes: string; renameTo: string }>(null);
  const [merging, setMerging] = useState<null | { source: string; target: string }>(null);

  const { data: records = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["production_records_min"], queryFn: fetchProdMinimal,
  });
  const { data: aliases = [] } = useQuery<Alias[]>({
    queryKey: ["product_aliases"],
    queryFn: async () => {
      const { data, error } = await supabase.from("product_aliases" as never).select("*");
      if (error) throw error;
      return (data ?? []) as Alias[];
    },
  });
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["product_categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("product_categories" as never).select("*");
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });

  const aliasMap = useMemo(() => {
    const m = new Map<string, string>();
    aliases.forEach(a => m.set(a.raw_name, a.canonical_name));
    return m;
  }, [aliases]);
  const catMap = useMemo(() => {
    const m = new Map<string, Category>();
    categories.forEach(c => m.set(c.canonical_name, c));
    return m;
  }, [categories]);

  const canonicalOf = (raw: string | null): string => {
    if (!raw) return "(sem produto)";
    const key = normalize(raw);
    return aliasMap.get(key) ?? key;
  };

  // Agregação por produto canônico
  const products = useMemo(() => {
    interface Agg { canonical: string; count: number; fpps: Set<string>; timeSec: number; machines: Set<number>; daysProduced: Set<string>; rawNames: Set<string>; }
    const map = new Map<string, Agg>();
    records.forEach(r => {
      const c = canonicalOf(r.produto);
      let a = map.get(c);
      if (!a) { a = { canonical: c, count: 0, fpps: new Set(), timeSec: 0, machines: new Set(), daysProduced: new Set(), rawNames: new Set() }; map.set(c, a); }
      a.count++;
      if (r.fpp) a.fpps.add(r.fpp);
      a.timeSec += r.tempo_fpp_seg ?? 0;
      if (r.maquina) a.machines.add(r.maquina);
      const d = parseLocalDate(r.dt_prog);
      if (d) a.daysProduced.add(ymd(d));
      if (r.produto) a.rawNames.add(normalize(r.produto));
    });
    return [...map.values()].map(a => {
      const cat = catMap.get(a.canonical);
      return {
        canonical: a.canonical,
        count: a.count,
        fpps: a.fpps.size,
        timeH: a.timeSec / 3600,
        avgTimeH: a.count > 0 ? (a.timeSec / a.count) / 3600 : 0,
        machines: [...a.machines].sort((x, y) => x - y),
        days: a.daysProduced.size,
        perDay: a.daysProduced.size > 0 ? a.fpps.size / a.daysProduced.size : 0,
        rawNames: [...a.rawNames].sort(),
        difficulty: cat?.difficulty ?? null,
        notes: cat?.notes ?? "",
      };
    }).sort((a, b) => b.count - a.count);
  }, [records, aliasMap, catMap]);

  const filteredProducts = useMemo(() => {
    const q = normalize(search);
    return products.filter(p => {
      if (q && !p.canonical.includes(q) && !p.rawNames.some(n => n.includes(q))) return false;
      if (difficultyFilter) {
        if (difficultyFilter === "none" && p.difficulty !== null) return false;
        if (difficultyFilter !== "none" && String(p.difficulty ?? "") !== difficultyFilter) return false;
      }
      return true;
    });
  }, [products, search, difficultyFilter]);

  // Mutations
  const saveCategory = useMutation({
    mutationFn: async (input: { canonical: string; difficulty: number; notes: string; renameTo: string }) => {
      const targetCanonical = normalize(input.renameTo) || input.canonical;
      // Rename: create/update aliases mapping all raw names of current canonical to new canonical
      if (targetCanonical !== input.canonical) {
        // Every current raw name that maps to input.canonical must now map to targetCanonical.
        // Also add input.canonical itself as an alias so future imports fold in.
        const rawsForOld = products.find(p => p.canonical === input.canonical)?.rawNames ?? [];
        const upserts = [
          { raw_name: input.canonical, canonical_name: targetCanonical },
          ...rawsForOld.map(r => ({ raw_name: r, canonical_name: targetCanonical })),
        ];
        const { error: e1 } = await supabase.from("product_aliases" as never).upsert(upserts, { onConflict: "raw_name" });
        if (e1) throw e1;
        // Migrate category row if exists
        const { data: existing } = await supabase.from("product_categories" as never).select("*").eq("canonical_name", input.canonical).maybeSingle();
        if (existing) {
          await supabase.from("product_categories" as never).delete().eq("canonical_name", input.canonical);
        }
      }
      const canonicalForCat = targetCanonical;
      const { error: e2 } = await supabase.from("product_categories" as never).upsert({
        canonical_name: canonicalForCat,
        difficulty: input.difficulty,
        notes: input.notes || null,
      }, { onConflict: "canonical_name" });
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Produto atualizado");
      qc.invalidateQueries({ queryKey: ["product_aliases"] });
      qc.invalidateQueries({ queryKey: ["product_categories"] });
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mergeProducts = useMutation({
    mutationFn: async (input: { source: string; target: string }) => {
      const target = normalize(input.target);
      if (!target) throw new Error("Escolha o produto destino");
      if (target === input.source) throw new Error("Origem e destino iguais");
      const rawsForSource = products.find(p => p.canonical === input.source)?.rawNames ?? [];
      const upserts = [
        { raw_name: input.source, canonical_name: target },
        ...rawsForSource.map(r => ({ raw_name: r, canonical_name: target })),
      ];
      const { error } = await supabase.from("product_aliases" as never).upsert(upserts, { onConflict: "raw_name" });
      if (error) throw error;
      // Se a origem tinha categoria e o destino não, migra
      const src = catMap.get(input.source);
      const dst = catMap.get(target);
      if (src && !dst) {
        await supabase.from("product_categories" as never).upsert({
          canonical_name: target, difficulty: src.difficulty, notes: src.notes,
        }, { onConflict: "canonical_name" });
      }
      if (src) await supabase.from("product_categories" as never).delete().eq("canonical_name", input.source);
    },
    onSuccess: () => {
      toast.success("Produtos mesclados");
      qc.invalidateQueries({ queryKey: ["product_aliases"] });
      qc.invalidateQueries({ queryKey: ["product_categories"] });
      setMerging(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalCount = products.reduce((s, p) => s + p.count, 0);
  const uncategorized = products.filter(p => p.difficulty === null).length;
  const uniqueRawNames = products.reduce((s, p) => s + p.rawNames.length, 0);

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Produtos — desempenho e categorização</h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            {isLoading ? "Carregando…" : `${fmtInt(products.length)} produtos distintos · ${fmtInt(uniqueRawNames)} variações de nome · ${fmtInt(totalCount)} registros`}
          </p>
        </div>
        <button onClick={() => refetch()} className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-secondary">
          <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} /> <span className="hidden sm:inline">Atualizar</span>
        </button>
      </header>

      {!isAdmin && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 text-warning text-xs px-3 py-2 flex items-center gap-2">
          <AlertTriangle className="size-4" /> Somente administradores podem editar produtos e categorias.
        </div>
      )}

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Produtos únicos</div>
          <div className="text-2xl font-bold">{fmtInt(products.length)}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Sem categoria</div>
          <div className="text-2xl font-bold text-warning">{fmtInt(uncategorized)}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Variações de nome</div>
          <div className="text-2xl font-bold">{fmtInt(uniqueRawNames)}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total de registros</div>
          <div className="text-2xl font-bold">{fmtInt(totalCount)}</div>
        </div>
      </section>

      <section className="bg-card border border-border rounded-xl p-3 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar produto…"
            className="w-full rounded-md border border-input bg-input/40 pl-9 pr-3 py-2 text-sm" />
        </div>
        <select value={difficultyFilter} onChange={e => setDifficultyFilter(e.target.value)}
          className="rounded-md border border-input bg-input/40 px-3 py-2 text-sm">
          <option value="">Todas as dificuldades</option>
          <option value="none">Sem categoria</option>
          {[1, 2, 3, 4, 5].map(d => <option key={d} value={String(d)}>{DIFFICULTY_LABEL[d]}</option>)}
        </select>
      </section>

      <section className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-auto max-h-[70vh]">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 sticky top-0">
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2">Produto (canônico)</th>
                <th className="px-3 py-2 text-center">Dificuldade</th>
                <th className="px-3 py-2 text-right">FPPs</th>
                <th className="px-3 py-2 text-right">Registros</th>
                <th className="px-3 py-2 text-right">Dias c/ produção</th>
                <th className="px-3 py-2 text-right">FPP/dia</th>
                <th className="px-3 py-2 text-right">Tempo médio</th>
                <th className="px-3 py-2">Máquinas</th>
                <th className="px-3 py-2">Variações</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 && (
                <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">Sem produtos.</td></tr>
              )}
              {filteredProducts.slice(0, 500).map(p => (
                <tr key={p.canonical} className="border-t border-border hover:bg-secondary/30">
                  <td className="px-3 py-2 font-medium">
                    <div className="flex items-center gap-2">
                      <Package className="size-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate max-w-[280px]" title={p.canonical}>{p.canonical}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {p.difficulty ? (
                      <span className={`inline-block px-2 py-0.5 rounded border text-[11px] font-semibold ${DIFFICULTY_COLOR[p.difficulty]}`}>
                        {p.difficulty}°
                      </span>
                    ) : <span className="text-[11px] text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{fmtInt(p.fpps)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtInt(p.count)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtInt(p.days)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtNum(p.perDay, 2)}</td>
                  <td className="px-3 py-2 text-right font-mono">{p.avgTimeH > 0 ? `${fmtNum(p.avgTimeH, 2)}h` : "—"}</td>
                  <td className="px-3 py-2 text-[11px] text-muted-foreground">{p.machines.join(", ") || "—"}</td>
                  <td className="px-3 py-2 text-[11px] text-muted-foreground">
                    {p.rawNames.length > 1 ? (
                      <span title={p.rawNames.join(" | ")} className="underline decoration-dotted cursor-help">{p.rawNames.length} nomes</span>
                    ) : "1"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isAdmin && (
                      <div className="inline-flex gap-1">
                        <button onClick={() => setEditing({ canonical: p.canonical, difficulty: p.difficulty ?? 3, notes: p.notes, renameTo: p.canonical })}
                          className="p-1.5 rounded hover:bg-secondary" title="Editar / renomear">
                          <Pencil className="size-3.5" />
                        </button>
                        <button onClick={() => setMerging({ source: p.canonical, target: "" })}
                          className="p-1.5 rounded hover:bg-secondary" title="Mesclar em outro produto">
                          <Merge className="size-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredProducts.length > 500 && (
          <div className="text-xs text-muted-foreground text-center py-2 border-t border-border">
            Exibindo 500 de {fmtInt(filteredProducts.length)}. Refine a busca.
          </div>
        )}
      </section>

      <div className="text-xs text-muted-foreground">
        * Categorias: 1° = muito fácil → 5° = muito difícil. Produtos digitados com nomes diferentes podem ser mesclados; a mesclagem cria um apelido no banco e não altera os registros originais.
      </div>

      {/* Editor */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar produto</DialogTitle>
            <DialogDescription>Categorize a dificuldade e/ou renomeie o produto (aplica-se a todas as variações).</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <label className="block space-y-1">
                <span className="text-xs uppercase text-muted-foreground">Nome (canônico)</span>
                <input value={editing.renameTo} onChange={e => setEditing({ ...editing, renameTo: e.target.value })}
                  className="w-full rounded-md border border-input bg-input/40 px-3 py-2 text-sm" />
                <span className="text-[11px] text-muted-foreground">Original: <span className="font-mono">{editing.canonical}</span></span>
              </label>
              <label className="block space-y-1">
                <span className="text-xs uppercase text-muted-foreground">Dificuldade</span>
                <select value={editing.difficulty} onChange={e => setEditing({ ...editing, difficulty: Number(e.target.value) })}
                  className="w-full rounded-md border border-input bg-input/40 px-3 py-2 text-sm">
                  {[1, 2, 3, 4, 5].map(d => <option key={d} value={d}>{DIFFICULTY_LABEL[d]}</option>)}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs uppercase text-muted-foreground">Notas</span>
                <textarea value={editing.notes} onChange={e => setEditing({ ...editing, notes: e.target.value })}
                  rows={3} className="w-full rounded-md border border-input bg-input/40 px-3 py-2 text-sm" />
              </label>
            </div>
          )}
          <DialogFooter>
            <button onClick={() => setEditing(null)} className="px-3 py-2 text-sm rounded border border-border">Cancelar</button>
            <button disabled={saveCategory.isPending} onClick={() => editing && saveCategory.mutate(editing)}
              className="px-3 py-2 text-sm rounded bg-primary text-primary-foreground disabled:opacity-50">
              {saveCategory.isPending ? "Salvando…" : "Salvar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge */}
      <Dialog open={!!merging} onOpenChange={(v) => !v && setMerging(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mesclar produto</DialogTitle>
            <DialogDescription>Todos os registros do produto de origem passarão a contar como o destino escolhido.</DialogDescription>
          </DialogHeader>
          {merging && (
            <div className="space-y-3">
              <div>
                <span className="text-xs uppercase text-muted-foreground">Origem</span>
                <div className="mt-1 px-3 py-2 rounded border border-border bg-secondary/30 text-sm font-mono">{merging.source}</div>
              </div>
              <label className="block space-y-1">
                <span className="text-xs uppercase text-muted-foreground">Destino (produto que absorve)</span>
                <input list="prod-list" value={merging.target} onChange={e => setMerging({ ...merging, target: e.target.value })}
                  placeholder="Digite ou escolha…"
                  className="w-full rounded-md border border-input bg-input/40 px-3 py-2 text-sm" />
                <datalist id="prod-list">
                  {products.filter(p => p.canonical !== merging.source).map(p => (
                    <option key={p.canonical} value={p.canonical} />
                  ))}
                </datalist>
              </label>
            </div>
          )}
          <DialogFooter>
            <button onClick={() => setMerging(null)} className="px-3 py-2 text-sm rounded border border-border">Cancelar</button>
            <button disabled={mergeProducts.isPending} onClick={() => merging && mergeProducts.mutate(merging)}
              className="px-3 py-2 text-sm rounded bg-primary text-primary-foreground disabled:opacity-50">
              {mergeProducts.isPending ? "Mesclando…" : "Mesclar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
