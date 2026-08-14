import { useRef, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, Field } from "./ui";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  parseFppsSheet,
  parseRgsSheet,
  readWorkbook,
  useDobraImports,
  type DobraFpp,
  type DobraRg,
} from "@/lib/dobra";
import {
  parseControleRgSheet,
  parsePerformanceSheet,
  type DobraCtrlRg,
  type DobraPerf,
} from "@/lib/dobraExtra";
import { fmtDate } from "@/lib/format";

interface Preview {
  file: File;
  sheetRgs: string;
  sheetFpps: string;
  rgs: DobraRg[];
  fpps: DobraFpp[];
  performance: DobraPerf[];
  controle: DobraCtrlRg[];
  novos: number;
  atualizados: number;
  semFpp: number;
  duplicados: number;
  ignorados: number;
  colunasNaoReconhecidas: string[];
}

export function DobraImportPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const { data: imports } = useDobraImports();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File) => {
    setBusy(true);
    try {
      const wb = await readWorkbook(file);
      const rgsParsed = parseRgsSheet(wb);
      const fppsParsed = parseFppsSheet(wb);
      const performanceParsed = parsePerformanceSheet(wb);
      const controleParsed = parseControleRgSheet(wb);
      if (rgsParsed.rows.length === 0 && fppsParsed.rows.length === 0 && performanceParsed.rows.length === 0 && controleParsed.rows.length === 0) {
        toast.error("Nenhuma linha reconhecida no arquivo.");
        return;
      }
      const { data: existentes } = await supabase.from("dobra_rgs").select("rg_key");
      const set = new Set((existentes ?? []).map((r) => r.rg_key));
      const novos = rgsParsed.rows.filter((r) => !set.has(r.rg_key)).length;
      setPreview({
        file,
        sheetRgs: rgsParsed.sheetName,
        sheetFpps: fppsParsed.sheetName,
        rgs: rgsParsed.rows,
        fpps: fppsParsed.rows,
        performance: performanceParsed.rows,
        controle: controleParsed.rows,
        novos,
        atualizados: rgsParsed.rows.length - novos,
        semFpp: rgsParsed.rows.filter((r) => !r.fpp_key).length,
        duplicados: performanceParsed.duplicados + controleParsed.duplicados,
        ignorados: performanceParsed.ignorados + controleParsed.ignorados,
        colunasNaoReconhecidas: [...rgsParsed.unknownCols, ...fppsParsed.unknownCols, ...performanceParsed.unknownCols, ...controleParsed.unknownCols].slice(0, 20),
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao ler o arquivo.");
    } finally {
      setBusy(false);
    }
  };

  const confirmar = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      const { data: imp, error: impErr } = await supabase
        .from("dobra_imports")
        .insert({
          filename: preview.file.name,
          tipo: "dobra",
          total_rows: preview.rgs.length + preview.fpps.length + preview.performance.length + preview.controle.length,
          inserted_rows: preview.novos,
          updated_rows: preview.atualizados,
        } as never)
        .select("id")
        .single();
      if (impErr) throw impErr;
      const import_id = (imp as { id: string }).id;

      const chunk = <T,>(arr: T[], n = 500) =>
        Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

      for (const part of chunk(preview.fpps)) {
        const { error } = await supabase
          .from("dobra_fpps")
          .upsert(part.map((f) => ({ ...f, import_id })) as never, { onConflict: "fpp_key" });
        if (error) throw error;
      }
      for (const part of chunk(preview.rgs)) {
        const { error } = await supabase
          .from("dobra_rgs")
          .upsert(part.map((r) => ({ ...r, import_id })) as never, { onConflict: "rg_key" });
        if (error) throw error;
      }
      for (const part of chunk(preview.performance)) {
        const { error } = await supabase
          .from("dobra_performance")
          .upsert(part.map((r) => ({ ...r, import_id })) as never, { onConflict: "fpp_key" });
        if (error) throw error;
      }
      for (const part of chunk(preview.controle)) {
        const { error } = await supabase
          .from("dobra_controle_rg")
          .upsert(part.map((r) => ({ ...r, import_id })) as never, { onConflict: "rg_key" });
        if (error) throw error;
      }

      await qc.invalidateQueries({ queryKey: ["dobra_rgs"] });
      await qc.invalidateQueries({ queryKey: ["dobra_fpps"] });
      await qc.invalidateQueries({ queryKey: ["dobra_imports"] });
      await qc.invalidateQueries({ queryKey: ["dobra_performance"] });
      await qc.invalidateQueries({ queryKey: ["dobra_controle_rg"] });
      toast.success(`Importação concluída: ${preview.novos} novos, ${preview.atualizados} atualizados.`);
      setPreview(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gravar os dados.");
    } finally {
      setBusy(false);
    }
  };

  const ALL = "00000000-0000-0000-0000-000000000000";

  const limparHistorico = async () => {
    if (!confirm("Apagar o histórico de importações? Os dados importados serão mantidos.")) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("dobra_imports").delete().neq("id", ALL);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["dobra_imports"] });
      toast.success("Histórico de importações apagado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao apagar o histórico.");
    } finally {
      setBusy(false);
    }
  };

  const limparLancamentos = async () => {
    if (!confirm("Apagar TODOS os lançamentos antigos da Dobra (RGs, FPPs, performance e controle)? Esta ação não pode ser desfeita.")) return;
    setBusy(true);
    try {
      for (const t of ["dobra_rgs", "dobra_fpps", "dobra_performance", "dobra_controle_rg"] as const) {
        const { error } = await supabase.from(t).delete().neq("id", ALL);
        if (error) throw error;
      }
      const { error: impErr } = await supabase.from("dobra_imports").delete().neq("id", ALL);
      if (impErr) throw impErr;
      for (const k of ["dobra_rgs", "dobra_fpps", "dobra_performance", "dobra_controle_rg", "dobra_imports"]) {
        await qc.invalidateQueries({ queryKey: [k] });
      }
      toast.success("Lançamentos antigos apagados.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao apagar os lançamentos.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <Card title="Importação de dados — Dobra">
        <div className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground max-w-2xl">
            Envie o arquivo <b>BANCO_DE_DADOS_-_DOBRA</b> (.xlsm, .xlsx, .xls ou .csv). O sistema valida as quatro abas:
            <b> BD-SCHED</b>, <b>BD-DADOS-DOBRA</b>, <b>BD-RELATORIO-PERFORMACE</b> e <b>BD-CONTROLE-RG</b>, normaliza os
            códigos (FPP-4625 = FPP4625 = FPP 4625) e atualiza os registros existentes pelo número da RG.
          </p>
          <div
            onClick={() => inputRef.current?.click()}
            className="cursor-pointer rounded-xl border border-dashed border-border p-10 text-center hover:border-primary/60"
          >
            <Upload className="size-8 mx-auto text-muted-foreground mb-2" />
            <div className="text-sm font-medium">Clique para selecionar o arquivo</div>
            <div className="text-xs text-muted-foreground">.xlsm · .xlsx · .xls · .csv</div>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsm,.xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </div>
      </Card>

      {preview && (
        <Card title="Conferência da importação">
          <div className="p-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Arquivo">
                <div className="text-sm truncate flex items-center gap-2">
                  <FileSpreadsheet className="size-4 text-primary shrink-0" />
                  {preview.file.name}
                </div>
              </Field>
              <Field label="Abas reconhecidas">
                <div className="text-sm truncate">4 de 4 abas</div>
              </Field>
              <Field label="Linhas lidas">
                <div className="text-sm tabular-nums">{preview.rgs.length} RGs · {preview.fpps.length} FPPs · {preview.performance.length} performance · {preview.controle.length} controle</div>
              </Field>
              <Field label="RGs sem FPP vinculada">
                <div className="text-sm tabular-nums">{preview.semFpp}</div>
              </Field>
            </div>
            <div className="text-xs text-muted-foreground">
              Validação: {preview.duplicados} duplicidades internas consolidadas · {preview.ignorados} linhas sem chave ignoradas. Registros existentes serão atualizados pela chave RG/FPP somente após a confirmação.
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-[var(--success)]/40 bg-[var(--success)]/10 p-3">
                <div className="text-xs uppercase text-muted-foreground">Registros novos</div>
                <div className="text-xl font-bold tabular-nums">{preview.novos}</div>
              </div>
              <div className="rounded-lg border border-primary/40 bg-primary/10 p-3">
                <div className="text-xs uppercase text-muted-foreground">Registros atualizados</div>
                <div className="text-xl font-bold tabular-nums">{preview.atualizados}</div>
              </div>
              <div className="rounded-lg border border-accent/40 bg-accent/10 p-3">
                <div className="text-xs uppercase text-muted-foreground">Colunas não reconhecidas</div>
                <div className="text-xl font-bold tabular-nums">{preview.colunasNaoReconhecidas.length}</div>
              </div>
            </div>
            {preview.colunasNaoReconhecidas.length > 0 && (
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <AlertTriangle className="size-4 text-warning shrink-0 mt-0.5" />
                <span>Ignoradas: {preview.colunasNaoReconhecidas.join(", ")}</span>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={confirmar}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                <CheckCircle2 className="size-4" /> {busy ? "Importando..." : "Confirmar importação"}
              </button>
              <button onClick={() => setPreview(null)} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary">
                Cancelar
              </button>
            </div>
          </div>
        </Card>
      )}

      <Card title="Histórico de importações">
        <div className="divide-y divide-border">
          {(imports ?? []).length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">Nenhuma importação registrada.</div>
          )}
          {(imports ?? []).map((i) => (
            <div key={i.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-sm">
              <div className="min-w-0 truncate">{i.filename}</div>
              <div className="text-xs text-muted-foreground shrink-0 tabular-nums">
                {i.inserted_rows} novos · {i.updated_rows} atualizados · {fmtDate(i.created_at)}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
