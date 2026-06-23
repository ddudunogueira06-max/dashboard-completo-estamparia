import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseOeePdf } from "@/lib/oeePdfParser";
import { fmtDate, fmtInt } from "@/lib/format";
import { Upload, FileText, CheckCircle2, AlertCircle, Trash2, History } from "lucide-react";

interface OeeImportRecord {
  id: string;
  arquivo: string;
  turno: number;
  maquina: number;
  mes_ref: string | null;
  total_dias: number;
  total_paradas: number;
  created_at: string;
}

async function fetchOeeImports(): Promise<OeeImportRecord[]> {
  const { data, error } = await supabase
    .from("oee_imports").select("*")
    .order("created_at", { ascending: false }).limit(50);
  if (error) throw error;
  return (data ?? []) as OeeImportRecord[];
}

export function OeeImportPage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const { data: imports = [] } = useQuery({ queryKey: ["oee_imports"], queryFn: fetchOeeImports });

  async function handleImport() {
    if (files.length === 0) return;
    setBusy(true); setFeedback(null);
    let totalDias = 0, totalParadas = 0, errs = 0;
    try {
      for (let idx = 0; idx < files.length; idx++) {
        const f = files[idx];
        setProgress(`Processando ${idx + 1}/${files.length}: ${f.name}`);
        try {
          const parsed = await parseOeePdf(f);

          const { data: imp, error: impErr } = await supabase
            .from("oee_imports")
            .insert({
              arquivo: parsed.filename, turno: parsed.turno, maquina: parsed.maquina,
              mes_ref: parsed.mes_ref, total_dias: parsed.dias.length, total_paradas: parsed.paradas.length,
            })
            .select().single();
          if (impErr) throw impErr;
          const importId = imp.id as string;

          if (parsed.dias.length > 0) {
            const dRows = parsed.dias.map((d) => ({
              ...d, import_id: importId, turno: parsed.turno, maquina: parsed.maquina,
            }));
            const { error: dErr } = await supabase.from("oee_dias")
              .upsert(dRows, { onConflict: "turno,maquina,data" });
            if (dErr) throw dErr;
          }
          if (parsed.paradas.length > 0) {
            // Replace existing aggregations for this mes/turno/maquina
            await supabase.from("oee_paradas")
              .delete()
              .eq("turno", parsed.turno).eq("maquina", parsed.maquina).eq("mes_ref", parsed.mes_ref);
            const pRows = parsed.paradas.map((p) => ({
              ...p, import_id: importId, turno: parsed.turno, maquina: parsed.maquina, mes_ref: parsed.mes_ref,
            }));
            const { error: pErr } = await supabase.from("oee_paradas").insert(pRows);
            if (pErr) throw pErr;
          }
          totalDias += parsed.dias.length;
          totalParadas += parsed.paradas.length;
        } catch (e) {
          errs++;
          console.error("Falha ao importar", f.name, e);
        }
      }
      setFeedback({
        type: errs === 0 ? "success" : "error",
        msg: `${files.length - errs}/${files.length} PDFs importados — ${fmtInt(totalDias)} dias e ${fmtInt(totalParadas)} paradas.${errs > 0 ? ` ${errs} com erro (veja console).` : ""}`,
      });
      setFiles([]);
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["oee_imports"] });
      qc.invalidateQueries({ queryKey: ["oee_dias"] });
      qc.invalidateQueries({ queryKey: ["oee_paradas"] });
    } catch (e) {
      setFeedback({ type: "error", msg: e instanceof Error ? e.message : String(e) });
    } finally { setBusy(false); setProgress(""); }
  }

  async function handleDeleteAll() {
    if (!confirm("Excluir TODOS os dados OEE importados?")) return;
    setBusy(true);
    await supabase.from("oee_paradas").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("oee_dias").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("oee_imports").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    setBusy(false);
    qc.invalidateQueries({ queryKey: ["oee_imports"] });
    qc.invalidateQueries({ queryKey: ["oee_dias"] });
    qc.invalidateQueries({ queryKey: ["oee_paradas"] });
    setFeedback({ type: "success", msg: "Dados OEE removidos." });
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Importar Relatórios OEE</h1>
        <p className="text-sm text-muted-foreground">
          Envie os PDFs de OEE no padrão <code className="text-primary">"&lt;turno&gt;º &lt;máquina&gt; &lt;MÊS&gt;.pdf"</code> (ex.: <code>1º 2000 MAIO.pdf</code>).
          Vários arquivos podem ser enviados de uma vez.
        </p>
      </header>

      <section className="bg-card border border-border rounded-xl p-6">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const fs = Array.from(e.dataTransfer.files ?? []).filter(f => /\.pdf$/i.test(f.name)); if (fs.length) setFiles(fs); }}
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-border rounded-lg p-10 text-center cursor-pointer hover:border-primary/60 hover:bg-secondary/30 transition-colors"
        >
          <input ref={fileRef} type="file" accept=".pdf" multiple className="hidden"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
          {files.length > 0 ? (
            <div className="space-y-2 text-left max-h-40 overflow-auto">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-3">
                  <FileText className="size-5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{f.name}</div>
                    <div className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(1)} KB</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="size-10 mx-auto text-muted-foreground" />
              <div className="font-medium">Clique ou arraste os PDFs aqui</div>
              <div className="text-xs text-muted-foreground">.pdf — vários arquivos suportados</div>
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
          <button onClick={handleDeleteAll} disabled={busy}
            className="inline-flex items-center gap-2 rounded-md border border-destructive/40 text-destructive bg-destructive/10 px-3 py-2 text-sm hover:bg-destructive/20 disabled:opacity-50">
            <Trash2 className="size-4" /> Limpar OEE
          </button>
          <button onClick={handleImport} disabled={files.length === 0 || busy}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
            <Upload className="size-4" /> {busy ? "Importando…" : `Importar ${files.length || ""}`}
          </button>
        </div>

        {progress && <div className="mt-4 text-sm text-muted-foreground">{progress}</div>}
        {feedback && (
          <div className={`mt-4 flex items-start gap-2 rounded-md p-3 text-sm ${
            feedback.type === "success" ? "bg-success/10 text-success border border-success/30" : "bg-destructive/10 text-destructive border border-destructive/30"
          }`}>
            {feedback.type === "success" ? <CheckCircle2 className="size-5 shrink-0" /> : <AlertCircle className="size-5 shrink-0" />}
            <span>{feedback.msg}</span>
          </div>
        )}
      </section>

      <section className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <History className="size-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Histórico de importações OEE</h3>
        </div>
        <div className="overflow-auto max-h-96">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 sticky top-0">
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 font-medium">Data</th>
                <th className="px-3 py-2 font-medium">Arquivo</th>
                <th className="px-3 py-2 font-medium text-right">Turno</th>
                <th className="px-3 py-2 font-medium text-right">Máquina</th>
                <th className="px-3 py-2 font-medium">Mês</th>
                <th className="px-3 py-2 font-medium text-right">Dias</th>
                <th className="px-3 py-2 font-medium text-right">Paradas</th>
              </tr>
            </thead>
            <tbody>
              {imports.map((i) => (
                <tr key={i.id} className="border-t border-border hover:bg-secondary/30">
                  <td className="px-3 py-2 text-muted-foreground text-xs">{fmtDate(i.created_at)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{i.arquivo}</td>
                  <td className="px-3 py-2 text-right">{i.turno}º</td>
                  <td className="px-3 py-2 text-right">{i.maquina}</td>
                  <td className="px-3 py-2 text-xs">{i.mes_ref ? fmtDate(i.mes_ref) : "—"}</td>
                  <td className="px-3 py-2 text-right">{fmtInt(i.total_dias)}</td>
                  <td className="px-3 py-2 text-right">{fmtInt(i.total_paradas)}</td>
                </tr>
              ))}
              {imports.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground text-sm">Nenhum PDF importado ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
