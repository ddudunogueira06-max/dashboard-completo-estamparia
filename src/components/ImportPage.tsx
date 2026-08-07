import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseExcelFile } from "@/lib/parseExcel";
import { fmtDate, fmtInt } from "@/lib/format";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Trash2, History } from "lucide-react";

interface ImportRecord {
  id: string;
  filename: string;
  total_rows: number;
  inserted_rows: number;
  skipped_rows: number;
  status: string;
  error_message: string | null;
  created_at: string;
}

async function fetchImports(): Promise<ImportRecord[]> {
  const { data, error } = await supabase
    .from("waste_imports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as ImportRecord[];
}

export function ImportPage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const { data: imports = [] } = useQuery({ queryKey: ["waste_imports"], queryFn: fetchImports });

  async function handleImport() {
    if (!file) return;
    setBusy(true);
    setFeedback(null);
    setProgress("Lendo planilha…");
    try {
      const rows = await parseExcelFile(file);
      if (rows.length === 0) throw new Error("Nenhuma linha válida encontrada na planilha.");

      if (mode === "replace") {
        setProgress("Removendo dados existentes…");
        const { error: delErr } = await supabase.from("waste_records").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (delErr) throw delErr;
      }

      // Create import record
      const { data: imp, error: impErr } = await supabase
        .from("waste_imports")
        .insert({ filename: file.name, total_rows: rows.length, status: "processing" })
        .select()
        .single();
      if (impErr) throw impErr;

      const importId = imp.id as string;
      let inserted = 0;
      let skipped = 0;
      const BATCH = 500;

      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH).map(r => ({ ...r, import_id: importId }));
        setProgress(`Importando ${i + batch.length} de ${rows.length}…`);
        const { error, count } = await supabase
          .from("waste_records")
          .upsert(batch, { onConflict: "numero,linha,codigo_item,data_registro", ignoreDuplicates: true, count: "exact" });
        if (error) throw error;
        const ins = count ?? 0;
        inserted += ins;
        skipped += batch.length - ins;
      }

      await supabase
        .from("waste_imports")
        .update({ inserted_rows: inserted, skipped_rows: skipped, status: "success" })
        .eq("id", importId);

      setFeedback({
        type: "success",
        msg: `Importação concluída! ${fmtInt(inserted)} novos registros inseridos${skipped > 0 ? `, ${fmtInt(skipped)} duplicados ignorados` : ""}.`,
      });
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["waste_records"] });
      qc.invalidateQueries({ queryKey: ["waste_imports"] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setFeedback({ type: "error", msg: `Erro: ${msg}` });
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  async function handleDeleteAll() {
    if (!confirm("Excluir TODOS os registros do banco? Esta ação não pode ser desfeita.")) return;
    setBusy(true);
    const { error } = await supabase.from("waste_records").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    setBusy(false);
    if (error) {
      setFeedback({ type: "error", msg: error.message });
    } else {
      setFeedback({ type: "success", msg: "Todos os registros foram removidos." });
      qc.invalidateQueries({ queryKey: ["waste_records"] });
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Importar Planilha</h1>
        <p className="text-sm text-muted-foreground">Envie a planilha diária (.xlsx ou .xlsm) com a aba "BD" para atualizar o dashboard.</p>
      </header>

      {/* Uploader */}
      <section className="bg-card border border-border rounded-xl p-6">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) { setFile(f); setPreviewCount((await parseExcelFile(f)).length); }
          }}
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-border rounded-lg p-10 text-center cursor-pointer hover:border-primary/60 hover:bg-secondary/30 transition-colors"
        >
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xlsm,.xls"
            className="hidden"
            onChange={async (e) => { const f=e.target.files?.[0] ?? null; setFile(f); setPreviewCount(f ? (await parseExcelFile(f)).length : null); }}
          />
          {file ? (
            <div className="flex items-center justify-center gap-3 text-foreground">
              <FileSpreadsheet className="size-8 text-primary" />
              <div className="text-left">
                <div className="font-medium">{file.name}</div>
                <div className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB · clique para trocar</div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="size-10 mx-auto text-muted-foreground" />
              <div className="font-medium">Clique ou arraste o arquivo aqui</div>
              <div className="text-xs text-muted-foreground">.xlsx, .xlsm ou .xls</div>
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          {previewCount !== null && <div className="w-full rounded-md border border-border bg-secondary/30 p-3 text-sm"><b>{fmtInt(previewCount)}</b> linhas válidas encontradas. Modo atual: <b>{mode === "replace" ? "substituir dados existentes" : "adicionar e ignorar duplicados"}</b>. Revise e confirme abaixo.</div>}
          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={mode === "append"} onChange={() => setMode("append")} className="accent-primary" />
              Adicionar (ignora duplicados)
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={mode === "replace"} onChange={() => setMode("replace")} className="accent-primary" />
              Substituir tudo
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDeleteAll}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-md border border-destructive/40 text-destructive bg-destructive/10 px-3 py-2 text-sm hover:bg-destructive/20 disabled:opacity-50"
            >
              <Trash2 className="size-4" /> Limpar banco
            </button>
            <button
              onClick={handleImport}
              disabled={!file || busy}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Upload className="size-4" /> {busy ? "Importando…" : "Importar"}
            </button>
          </div>
        </div>

        {progress && (
          <div className="mt-4 text-sm text-muted-foreground">{progress}</div>
        )}
        {feedback && (
          <div className={`mt-4 flex items-start gap-2 rounded-md p-3 text-sm ${
            feedback.type === "success" ? "bg-success/10 text-success border border-success/30" : "bg-destructive/10 text-destructive border border-destructive/30"
          }`}>
            {feedback.type === "success" ? <CheckCircle2 className="size-5 shrink-0" /> : <AlertCircle className="size-5 shrink-0" />}
            <span>{feedback.msg}</span>
          </div>
        )}
      </section>

      {/* Mapping reference */}
      <section className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">Colunas esperadas na planilha</h3>
        <div className="text-sm text-muted-foreground">
          A leitura usa a aba <code className="text-primary">BD</code> e mapeia automaticamente:
          {" "}<code>Tipo</code>, <code>Número</code>, <code>Código do Item</code>, <code>Descrição</code>,
          {" "}<code>Armazém</code>, <code>Fator de Perda (%)</code>, <code>Linha</code>,
          {" "}<code>Qtde. Solicitada (m²)</code>, <code>Data de Registro</code>, <code>Retalho (m²)</code>, <code>Status</code>.
        </div>
        <div className="text-xs text-muted-foreground mt-2">
          Chave única para evitar duplicidade: Número + Linha + Código do Item + Data de Registro.
        </div>
      </section>

      {/* History */}
      <section className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <History className="size-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Histórico de importações</h3>
        </div>
        <div className="overflow-auto max-h-96">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 sticky top-0">
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 font-medium">Data</th>
                <th className="px-3 py-2 font-medium">Arquivo</th>
                <th className="px-3 py-2 font-medium text-right">Total</th>
                <th className="px-3 py-2 font-medium text-right">Inseridos</th>
                <th className="px-3 py-2 font-medium text-right">Ignorados</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {imports.map((i) => (
                <tr key={i.id} className="border-t border-border hover:bg-secondary/30">
                  <td className="px-3 py-2 text-muted-foreground text-xs">{fmtDate(i.created_at)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{i.filename}</td>
                  <td className="px-3 py-2 text-right">{fmtInt(i.total_rows)}</td>
                  <td className="px-3 py-2 text-right text-success">{fmtInt(i.inserted_rows)}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{fmtInt(i.skipped_rows)}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs ${i.status === "success" ? "text-success" : i.status === "error" ? "text-destructive" : "text-warning"}`}>
                      {i.status}
                    </span>
                  </td>
                </tr>
              ))}
              {imports.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground text-sm">Nenhuma importação registrada ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
