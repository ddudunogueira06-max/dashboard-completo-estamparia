import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { displayCode, normKey } from "@/lib/dobra";

/* ------------------------------------------------------------------ */
/* Tipos                                                               */
/* ------------------------------------------------------------------ */

export interface DobraPerf {
  fpp_key: string;
  fpp: string;
  maquina: string | null;
  qtd_pecas: number | null;
  tempo_estimado_seg: number | null;
  tempo_planejado_seg: number | null;
  tempo_real_seg: number | null;
  data_inicio: string | null;
  data_final: string | null;
  qtd_produzida: number | null;
  qtd_refugo: number | null;
  qtd_retrabalho: number | null;
  performance: number | null;
  obs: string | null;
}

export interface DobraCtrlRg {
  rg_key: string;
  rg: string;
  cliente: string | null;
  produto: string | null;
  quantidade: number | null;
  data_rg: string | null;
  data_planejamento: string | null;
  ultima_seq: number | null;
  data_conclusao: string | null;
  tempo_execucao_dias: number | null;
  data_pacote: string | null;
  fpp_key: string | null;
  fpp: string | null;
  sla: string | null;
  ta_rg: number | null;
  eficiencia: number | null;
}

/* ------------------------------------------------------------------ */
/* Helpers de célula                                                   */
/* ------------------------------------------------------------------ */

const str = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  const s = String(v).trim();
  return s === "" || s.toUpperCase() === "N/A" || s === "#N/D" ? null : s;
};

export const num = (v: unknown): number | null => {
  const s = str(v);
  if (s === null) return null;
  const cleaned = s.replace(/[^0-9,\.\-]/g, "");
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
};

const validDate = (y: number, m: number, d: number): string | null => {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d) || y < 1900 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const parsed = new Date(Date.UTC(y, m - 1, d));
  if (parsed.getUTCFullYear() !== y || parsed.getUTCMonth() !== m - 1 || parsed.getUTCDate() !== d) return null;
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};

const date = (v: unknown): string | null => {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : validDate(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate());
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    return d ? validDate(d.y, d.m, d.d) : null;
  }
  const s = String(v).trim();
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (br) {
    const y = br[3].length === 2 ? `20${br[3]}` : br[3];
    return validDate(Number(y), Number(br[2]), Number(br[1]));
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const n = Number(s.replace(",", "."));
  if (Number.isFinite(n) && n > 20000 && n < 80000) {
    const d = XLSX.SSF.parse_date_code(n);
    return d ? validDate(d.y, d.m, d.d) : null;
  }
  return null;
};

/**
 * Converte um valor de tempo em segundos.
 * Aceita "hh:mm:ss", fração de dia do Excel (0,25 = 6h), minutos e segundos puros.
 */
export const toSeconds = (v: unknown, unit: "auto" | "min" | "seg" | "dia" = "auto"): number | null => {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return v.getHours() * 3600 + v.getMinutes() * 60 + v.getSeconds();
  const s = String(v).trim();
  const hms = s.match(/^(\d{1,5}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (hms) return +hms[1] * 3600 + +hms[2] * 60 + +(hms[3] ?? 0);
  const n = num(s);
  if (n === null) return null;
  if (unit === "min") return Math.round(n * 60);
  if (unit === "dia") return Math.round(n * 86400);
  if (unit === "seg") return Math.round(n);
  // auto: valores <= 3 são quase sempre fração de dia vinda do Excel
  return n > 0 && n <= 3 ? Math.round(n * 86400) : Math.round(n);
};

/* ------------------------------------------------------------------ */
/* Leitura com detecção da linha de cabeçalho                          */
/* ------------------------------------------------------------------ */

export interface SheetTable {
  sheetName: string;
  headers: string[];
  rows: Record<string, unknown>[];
}

const findSheet = (wb: XLSX.WorkBook, wanted: string[]): string | null => {
  for (const w of wanted) {
    const exact = wb.SheetNames.find((n) => normKey(n) === normKey(w));
    if (exact) return exact;
  }
  for (const w of wanted) {
    const partial = wb.SheetNames.find((n) => normKey(n).includes(normKey(w)));
    if (partial) return partial;
  }
  return null;
};

/** Lê a aba localizando automaticamente a linha de cabeçalho (até a linha 12). */
export function readSheetTable(wb: XLSX.WorkBook, wanted: string[]): SheetTable | null {
  const sheetName = findSheet(wb, wanted);
  if (!sheetName) return null;
  const ws = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true });
  let headerIdx = -1;
  let best = 0;
  for (let i = 0; i < Math.min(matrix.length, 12); i++) {
    const values = (matrix[i] ?? []).map(str).filter((c): c is string => c !== null);
    const meaningful = values.filter((c) => !/^Column\d+$/i.test(c) && !/^col_\d+$/i.test(c)).length;
    const headerWords = values.filter((c) => /[A-Za-zÀ-ÿ]/.test(c) && !/^Column\d+$/i.test(c)).length;
    const score = meaningful * 2 + headerWords;
    if (score > best && meaningful >= 3) {
      best = score;
      headerIdx = i;
    }
  }
  if (headerIdx < 0) return { sheetName, headers: [], rows: [] };
  const headers = (matrix[headerIdx] ?? []).map((h, i) => str(h) ?? `col_${i}`);
  const rows: Record<string, unknown>[] = [];
  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const line = matrix[i] ?? [];
    if (line.every((c) => str(c) === null)) continue;
    const obj: Record<string, unknown> = {};
    headers.forEach((h, j) => (obj[h] = line[j] ?? null));
    rows.push(obj);
  }
  return { sheetName, headers, rows };
}

const col = (headers: string[], candidates: string[]) =>
  headers.find((h) => candidates.some((c) => normKey(h) === normKey(c))) ??
  headers.find((h) => candidates.some((c) => normKey(h).includes(normKey(c)))) ??
  null;

export interface ParseResult<T> {
  rows: T[];
  sheetName: string;
  unknownCols: string[];
  duplicados: number;
  ignorados: number;
}

const EMPTY = <T,>(): ParseResult<T> => ({ rows: [], sheetName: "—", unknownCols: [], duplicados: 0, ignorados: 0 });

/** Banco 3 — BD-RELATORIO-PERFORMACE (performance por FPP). */
export function parsePerformanceSheet(wb: XLSX.WorkBook): ParseResult<DobraPerf> {
  const t = readSheetTable(wb, ["BD-RELATORIO-PERFORMACE", "BD RELATORIO PERFORMACE", "RELATORIO PERFORMACE", "PERFORMANCE"]);
  if (!t) return EMPTY<DobraPerf>();
  const h = t.headers;
  const c = {
    fpp: col(h, ["NrFPP", "Nr FPP", "FPP", "Pacote"]),
    maquina: col(h, ["Maquina", "Máquina", "Recurso"]),
    pecas: col(h, ["QuantidadePecas", "Quantidade Pecas", "Qtde Peças", "Peças"]),
    est: col(h, ["TempoEstimado", "Tempo Estimado"]),
    plan: col(h, ["TempoPlanejado", "Tempo Planejado", "TempoPlanejado(min)", "Minutos Planejados"]),
    real: col(h, ["TempoReal", "Tempo Real", "TempoReal(min)", "Minutos Reais"]),
    ini: col(h, ["DataInicio", "Data Inicio", "Início"]),
    fim: col(h, ["DataFinal", "Data Final", "Fim"]),
    prod: col(h, ["QuantidadeProduzida", "Produzida", "Produzido"]),
    refugo: col(h, ["Refugo", "Refugada"]),
    retrab: col(h, ["Retrabalho"]),
    perf: col(h, ["Performance", "Eficiencia", "Eficiência"]),
    obs: col(h, ["Observacao", "Observação", "Obs"]),
  };
  const used = new Set(Object.values(c).filter(Boolean) as string[]);
  const map = new Map<string, DobraPerf>();
  let duplicados = 0;
  let ignorados = 0;
  for (const r of t.rows) {
    const raw = c.fpp ? str(r[c.fpp]) : null;
    const key = raw ? normKey(raw) : "";
    if (!key) {
      ignorados++;
      continue;
    }
    if (map.has(key)) duplicados++;
    const perf = c.perf ? num(r[c.perf]) : null;
    map.set(key, {
      fpp_key: key,
      fpp: displayCode(raw),
      maquina: c.maquina ? str(r[c.maquina]) : null,
      qtd_pecas: c.pecas ? num(r[c.pecas]) : null,
      tempo_estimado_seg: c.est ? toSeconds(r[c.est]) : null,
      tempo_planejado_seg: c.plan ? toSeconds(r[c.plan], /min/i.test(c.plan) ? "min" : "auto") : null,
      tempo_real_seg: c.real ? toSeconds(r[c.real], /min/i.test(c.real) ? "min" : "auto") : null,
      data_inicio: c.ini ? date(r[c.ini]) : null,
      data_final: c.fim ? date(r[c.fim]) : null,
      qtd_produzida: c.prod ? num(r[c.prod]) : null,
      qtd_refugo: c.refugo ? num(r[c.refugo]) : null,
      qtd_retrabalho: c.retrab ? num(r[c.retrab]) : null,
      performance: perf === null ? null : perf <= 3 ? perf * 100 : perf,
      obs: c.obs ? str(r[c.obs]) : null,
    });
  }
  return {
    rows: Array.from(map.values()),
    sheetName: t.sheetName,
    unknownCols: h.filter((x) => !used.has(x) && !/^col_\d+$/.test(x)),
    duplicados,
    ignorados,
  };
}

/** Banco 4 — BD-CONTROLE-RG (SLA, atravessamento e eficiência por RG). */
export function parseControleRgSheet(wb: XLSX.WorkBook): ParseResult<DobraCtrlRg> {
  const t = readSheetTable(wb, ["BD-CONTROLE-RG", "BD CONTROLE RG", "CONTROLE RG", "CONTROLE-RG"]);
  if (!t) return EMPTY<DobraCtrlRg>();
  const h = t.headers;
  const c = {
    rg: col(h, ["NumeroRg", "Numero RG", "Nº RG", "RG"]),
    cliente: col(h, ["Cliente"]),
    produto: col(h, ["Produto"]),
    qtd: col(h, ["QUANTIDADE", "Quantidade", "Qtde"]),
    dataRg: col(h, ["DataRg", "Data RG", "RgData"]),
    plan: col(h, ["DataPlanejamento", "Data Planejamento"]),
    seq: col(h, ["UltimaSeq", "Ultima Seq", "UltimaSequenciaExecucao", "Seq"]),
    concl: col(h, ["DataConclusao", "Data Conclusão", "Conclusao"]),
    exec: col(h, ["TempoExecucao", "Tempo Execucao", "Tempo Execução"]),
    pacote: col(h, ["DataPacote", "Data Pacote", "DtPacote"]),
    fpp: col(h, ["NrFPP", "FPP", "Pacote"]),
    sla: col(h, ["SLA"]),
    ta: col(h, ["T.A.RG", "TA RG", "Atravessamento"]),
    efi: col(h, ["Eficiencia", "Eficiência"]),
  };
  const used = new Set(Object.values(c).filter(Boolean) as string[]);
  const map = new Map<string, DobraCtrlRg>();
  let duplicados = 0;
  let ignorados = 0;
  for (const r of t.rows) {
    const raw = c.rg ? str(r[c.rg]) : null;
    const key = raw ? normKey(raw) : "";
    if (!key) {
      ignorados++;
      continue;
    }
    if (map.has(key)) duplicados++;
    const fppRaw = c.fpp ? str(r[c.fpp]) : null;
    const efi = c.efi ? num(r[c.efi]) : null;
    map.set(key, {
      rg_key: key,
      rg: displayCode(raw),
      cliente: c.cliente ? str(r[c.cliente]) : null,
      produto: c.produto ? str(r[c.produto]) : null,
      quantidade: c.qtd ? num(r[c.qtd]) : null,
      data_rg: c.dataRg ? date(r[c.dataRg]) : null,
      data_planejamento: c.plan ? date(r[c.plan]) : null,
      ultima_seq: c.seq ? (num(r[c.seq]) ?? null) : null,
      data_conclusao: c.concl ? date(r[c.concl]) : null,
      tempo_execucao_dias: c.exec ? num(r[c.exec]) : null,
      data_pacote: c.pacote ? date(r[c.pacote]) : null,
      fpp_key: fppRaw ? normKey(fppRaw) : null,
      fpp: fppRaw ? displayCode(fppRaw) : null,
      sla: c.sla ? str(r[c.sla]) : null,
      ta_rg: c.ta ? num(r[c.ta]) : null,
      eficiencia: efi === null ? null : efi <= 3 ? efi * 100 : efi,
    });
  }
  return {
    rows: Array.from(map.values()),
    sheetName: t.sheetName,
    unknownCols: h.filter((x) => !used.has(x) && !/^col_\d+$/.test(x)),
    duplicados,
    ignorados,
  };
}

/* ------------------------------------------------------------------ */
/* Hooks                                                               */
/* ------------------------------------------------------------------ */

async function pageAll<T>(table: string, order: string): Promise<T[]> {
  const size = 1000;
  let from = 0;
  const all: T[] = [];
  for (;;) {
    const { data, error } = await supabase
      .from(table as never)
      .select("*")
      .order(order, { ascending: false })
      .range(from, from + size - 1);
    if (error) throw error;
    const rows = (data ?? []) as unknown as T[];
    all.push(...rows);
    if (rows.length < size) break;
    from += size;
  }
  return all;
}

export const useDobraPerformance = () =>
  useQuery({ queryKey: ["dobra_performance"], queryFn: () => pageAll<DobraPerf>("dobra_performance", "created_at") });

export const useDobraControleRg = () =>
  useQuery({ queryKey: ["dobra_controle_rg"], queryFn: () => pageAll<DobraCtrlRg>("dobra_controle_rg", "created_at") });

/* ------------------------------------------------------------------ */
/* Agregações para o relatório                                         */
/* ------------------------------------------------------------------ */

export interface PerfResumo {
  fpps: number;
  pecas: number;
  produzidas: number;
  refugo: number;
  retrabalho: number;
  planejadoSeg: number;
  realSeg: number;
  performance: number;
}

export function resumoPerformance(rows: DobraPerf[]): PerfResumo {
  const sum = (f: (r: DobraPerf) => number | null | undefined) => rows.reduce((s, r) => s + (f(r) ?? 0), 0);
  const planejadoSeg = sum((r) => r.tempo_planejado_seg ?? r.tempo_estimado_seg);
  const realSeg = sum((r) => r.tempo_real_seg);
  return {
    fpps: rows.length,
    pecas: sum((r) => r.qtd_pecas),
    produzidas: sum((r) => r.qtd_produzida),
    refugo: sum((r) => r.qtd_refugo),
    retrabalho: sum((r) => r.qtd_retrabalho),
    planejadoSeg,
    realSeg,
    performance: realSeg > 0 ? (planejadoSeg / realSeg) * 100 : 0,
  };
}

export interface CtrlResumo {
  total: number;
  concluidos: number;
  noPrazo: number;
  slaPct: number;
  leadMedioDias: number;
  eficienciaMedia: number;
  pecas: number;
}

const slaPositivo = (v: string | null) => {
  if (!v) return null;
  const k = normKey(v);
  if (k.includes("NOPRAZO") || k === "OK" || k.includes("DENTRO") || k === "SIM") return true;
  if (k.includes("FORA") || k.includes("ATRAS") || k === "NAO") return false;
  return null;
};

export function resumoControleRg(rows: DobraCtrlRg[]): CtrlResumo {
  const concluidos = rows.filter((r) => r.data_conclusao);
  const avaliados = rows.map((r) => slaPositivo(r.sla)).filter((v): v is boolean => v !== null);
  const leads = concluidos.map((r) => r.ta_rg).filter((v): v is number => v !== null);
  const efis = rows.map((r) => r.eficiencia).filter((v): v is number => v !== null && v > 0);
  return {
    total: rows.length,
    concluidos: concluidos.length,
    noPrazo: avaliados.filter(Boolean).length,
    slaPct: avaliados.length ? (avaliados.filter(Boolean).length / avaliados.length) * 100 : 0,
    leadMedioDias: leads.length ? leads.reduce((a, b) => a + b, 0) / leads.length : 0,
    eficienciaMedia: efis.length ? efis.reduce((a, b) => a + b, 0) / efis.length : 0,
    pecas: rows.reduce((s, r) => s + (r.quantidade ?? 0), 0),
  };
}

export function controleRgPorMes(rows: DobraCtrlRg[], meses = 12) {
  const map = new Map<string, { total: number; ok: number; pecas: number; lead: number[] }>();
  for (const r of rows) {
    const d = r.data_conclusao ?? r.data_rg;
    if (!d) continue;
    const key = d.slice(0, 7);
    const cur = map.get(key) ?? { total: 0, ok: 0, pecas: 0, lead: [] };
    cur.total++;
    if (slaPositivo(r.sla)) cur.ok++;
    cur.pecas += r.quantidade ?? 0;
    if (r.ta_rg !== null) cur.lead.push(r.ta_rg);
    map.set(key, cur);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-meses)
    .map(([key, v]) => ({
      label: `${key.slice(5, 7)}/${key.slice(2, 4)}`,
      rgs: v.total,
      pecas: v.pecas,
      sla: v.total ? Number(((v.ok / v.total) * 100).toFixed(1)) : 0,
      lead: v.lead.length ? Number((v.lead.reduce((a, b) => a + b, 0) / v.lead.length).toFixed(1)) : 0,
    }));
}
