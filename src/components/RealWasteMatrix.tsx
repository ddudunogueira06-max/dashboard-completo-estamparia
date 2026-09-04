import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fmtPct } from "@/lib/format";
import { Pencil, Save, X } from "lucide-react";

const SETTINGS_KEY = "desperdicio.real.v1";

const MONTH_NAMES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

const MATERIALS = [
  { key: "inox", label: "INOX", meta: 27, color: "oklch(0.72 0.15 215)" },
  { key: "galvanizado", label: "GALVANIZADO", meta: 13, color: "oklch(0.78 0.16 75)" },
  { key: "aluminio", label: "ALUMÍNIO", meta: 24, color: "oklch(0.7 0.16 155)" },
] as const;

type Store = Record<string, Record<string, (number | null)[]>>;

const emptyYear = (): Record<string, (number | null)[]> =>
  Object.fromEntries(MATERIALS.map(m => [m.key, Array(12).fill(null)]));

export function RealWasteMatrix({ year, inputCls }: { year: string; inputCls: string }) {
  const [store, setStore] = useState<Store>({});
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.from("dobra_settings").select("value").eq("key", SETTINGS_KEY).maybeSingle();
      if (alive && data?.value) setStore((data.value ?? {}) as Store);
    })();
    return () => { alive = false; };
  }, []);

  const yearData = useMemo(() => store[year] ?? emptyYear(), [store, year]);

  const startEdit = () => {
    setDraft(Object.fromEntries(MATERIALS.map(m => [
      m.key, (yearData[m.key] ?? Array(12).fill(null)).map(v => (v === null || v === undefined ? "" : String(v).replace(".", ","))),
    ])));
    setMsg(null);
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const parsed: Record<string, (number | null)[]> = {};
    MATERIALS.forEach(m => {
      parsed[m.key] = (draft[m.key] ?? []).map(s => {
        const n = Number(String(s).replace("%", "").replace(",", ".").trim());
        return s.trim() === "" || Number.isNaN(n) ? null : n;
      });
    });
    const next: Store = { ...store, [year]: parsed };
    const { error } = await supabase.from("dobra_settings").upsert({ key: SETTINGS_KEY, value: next as never }, { onConflict: "key" });
    setSaving(false);
    if (error) { setMsg("Não foi possível salvar: " + error.message); return; }
    setStore(next);
    setEditing(false);
  };

  const rows = MATERIALS.map(m => {
    const vals = yearData[m.key] ?? Array(12).fill(null);
    const nums = vals.filter((v): v is number => typeof v === "number");
    const acc = nums.length ? nums.reduce((s, v) => s + v, 0) / nums.length : null;
    return { ...m, vals, acc };
  });

  const hasData = rows.some(r => r.vals.some(v => typeof v === "number"));

  return (
    <div className="overflow-auto">
      <div className="flex justify-end mb-2 gap-2">
        {editing ? (
          <>
            <button type="button" onClick={save} disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary/15 hover:bg-primary/25 border border-primary/40 text-primary text-xs font-semibold px-3 py-1.5">
              <Save className="size-3.5" /> {saving ? "Salvando…" : "Salvar"}
            </button>
            <button type="button" onClick={() => setEditing(false)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground text-xs font-semibold px-3 py-1.5">
              <X className="size-3.5" /> Cancelar
            </button>
          </>
        ) : (
          <button type="button" onClick={startEdit}
            className="inline-flex items-center gap-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground text-xs font-semibold px-3 py-1.5">
            <Pencil className="size-3.5" /> Lançar valores
          </button>
        )}
      </div>
      {msg && <div className="mb-2 text-xs text-destructive">{msg}</div>}
      {!hasData && !editing ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          Nenhum valor do KPI lançado para {year}. Clique em “Lançar valores” para informar os percentuais reais.
        </div>
      ) : (
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-3 py-2 bg-secondary/40 rounded-l-md">Indicador</th>
              <th className="px-2 py-2 bg-secondary/40">Meta<br />Mensal</th>
              {MONTH_NAMES.map(m => <th key={m} className="px-2 py-2 bg-secondary/40">{m}</th>)}
              <th className="px-2 py-2 bg-secondary/40 rounded-r-md">Média<br />Acumulada</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.key} className="border-t border-border">
                <td className="px-3 py-2.5 whitespace-nowrap font-semibold">
                  <span className="inline-block size-2.5 rounded-full mr-2 align-middle" style={{ background: row.color }} />
                  {row.label}
                </td>
                <td className="px-2 py-2.5 text-center text-muted-foreground font-medium">{row.meta.toFixed(2)}%</td>
                {Array.from({ length: 12 }).map((_, i) => (
                  <td key={i} className="px-1 py-2 text-center font-mono">
                    {editing ? (
                      <input
                        value={draft[row.key]?.[i] ?? ""}
                        onChange={(e) => setDraft(prev => {
                          const arr = [...(prev[row.key] ?? Array(12).fill(""))];
                          arr[i] = e.target.value;
                          return { ...prev, [row.key]: arr };
                        })}
                        placeholder="—"
                        className={`${inputCls} px-1 py-1 text-center text-xs`}
                      />
                    ) : row.vals[i] === null || row.vals[i] === undefined ? (
                      <span className="text-muted-foreground/50">—</span>
                    ) : (
                      <span className={(row.vals[i] as number) > row.meta ? "text-destructive font-semibold" : "text-success font-medium"}>
                        {fmtPct(row.vals[i] as number)}
                      </span>
                    )}
                  </td>
                ))}
                <td className="px-2 py-2.5 text-center font-mono font-bold">
                  {row.acc === null ? "—" : (
                    <span className={row.acc > row.meta ? "text-destructive" : "text-success"}>{fmtPct(row.acc)}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="mt-3 flex items-center gap-4 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-success" /> abaixo da meta</span>
        <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-destructive" /> acima da meta (GALV 13% · ALUM 24% · INOX 27%)</span>
        <span>Valores do KPI oficial (lançamento manual)</span>
      </div>
    </div>
  );
}
