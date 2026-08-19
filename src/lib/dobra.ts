import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

/* ------------------------------------------------------------------ */
/* Tipos                                                               */
/* ------------------------------------------------------------------ */

export interface DobraRg {
  id?: string;
  rg_key: string;
  rg: string;
  fpp_key: string | null;
  fpp: string | null;
  status: string | null;
  cliente: string | null;
  nr_ov: string | null;
  data_rg: string | null;
  produto: string | null;
  item_ov: string | null;
  tarefa_desc: string | null;
  operador: string | null;
  maquina_ativa: string | null;
  data_planejamento: string | null;
  data_conclusao: string | null;
  tempo_seg: number | null;
}

export interface DobraFpp {
  id?: string;
  fpp_key: string;
  fpp: string;
  dt_programada: string | null;
  seq: number | null;
  produto: string | null;
  linha: string | null;
  cliente: string | null;
  item: string | null;
  data_rg: string | null;
  dt_pacote: string | null;
  dt_fim_prog: string | null;
  dt_planejamento: string | null;
  tempo_fpp_seg: number | null;
  maquina: number | null;
}

export interface Capacidade {
  horasDiaDobra: string;
  turno1: string;
  turno2: string;
  dobradeiras: number;
  feriasT1: number;
  feriasT2: number;
  afastadosT1: number;
  afastadosT2: number;
  manual: boolean;
  capacidadeManual: string;
  obs: string;
}

export interface MetaParams {
  metaRgsDia: number;
  periodoMedia: number;
  ignorarFimDeSemana: boolean;
  somenteDiasComProducao: boolean;
  metaSla: number;
}

export type Situacao = "concluida" | "logistica" | "separacao" | "em_producao" | "disponivel" | "aguardando";

export const SITUACAO_LABEL: Record<Situacao, string> = {
  concluida: "Concluída",
  logistica: "Logística interna",
  separacao: "Em separação",
  em_producao: "Em produção",
  disponivel: "Disponível para dobrar",
  aguardando: "Aguardando etapa anterior",
};

/** RGs já dobradas: concluídas ou que seguiram para logística/separação. */
export const isDobrada = (s: Situacao) => s === "concluida" || s === "logistica" || s === "separacao";


/* ------------------------------------------------------------------ */
/* Normalização / formatação                                           */
/* ------------------------------------------------------------------ */

/** Remove espaços, traços e demais separadores para comparação de códigos. */
export const normKey = (v: unknown): string =>
  v === null || v === undefined ? "" : String(v).toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Apresentação padronizada: RG0063903 / FPP-4625 / FPG-4645 / DIV-4607 */
export function displayCode(raw: string | null | undefined): string {
  if (!raw) return "—";
  const k = normKey(raw);
  const m = k.match(/^([A-Z]+)(\d+)$/);
  if (!m) return raw;
  const [, pref, num] = m;
  if (pref === "RG") return `RG${num.padStart(7, "0")}`;
  return `${pref}-${num}`;
}

/** Prefixo do código do pacote: FPP, FPG, DIV... */
export const tipoCode = (raw: string | null | undefined): string =>
  normKey(raw).match(/^([A-Z]+)/)?.[1] ?? "";


export const secToHms = (sec: number | null | undefined): string => {
  const s = Math.max(0, Math.round(sec ?? 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
};

/** Hora do dia (HH:MM) a partir de segundos desde a meia-noite. */
export const secToHoraDia = (sec: number | null | undefined): string => {
  if (sec === null || sec === undefined) return "—";
  const s = Math.max(0, Math.round(sec)) % 86400;
  return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}`;
};


export function hmsToSec(v: string | null | undefined): number {
  if (!v) return 0;
  const m = String(v).trim().match(/^(\d{1,4}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (!m) return 0;
  return +m[1] * 3600 + +m[2] * 60 + +(m[3] ?? 0);
}

export const fmtBrDate = (v: string | null | undefined): string => {
  if (!v) return "—";
  const s = String(v).slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
};

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const addDaysISO = (iso: string, days: number) => {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

/* ------------------------------------------------------------------ */
/* Leitura de arquivos (xlsx / xls / csv)                              */
/* ------------------------------------------------------------------ */

function cellStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  const s = String(v).trim();
  return s === "" || s.toUpperCase() === "N/A" ? null : s;
}

function validDate(y: number, m: number, d: number): string | null {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d) || y < 1900 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const parsed = new Date(Date.UTC(y, m - 1, d));
  if (parsed.getUTCFullYear() !== y || parsed.getUTCMonth() !== m - 1 || parsed.getUTCDate() !== d) return null;
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function cellDate(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : validDate(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate());
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    return d ? validDate(d.y, d.m, d.d) : null;
  }
  const s = String(v).trim();
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return validDate(Number(br[3]), Number(br[2]), Number(br[1]));
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  return null;
}

function cellSec(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return v.getHours() * 3600 + v.getMinutes() * 60 + v.getSeconds();
  if (typeof v === "number") return v <= 2 ? Math.round(v * 86400) : Math.round(v);
  const s = String(v).trim();
  const m = s.match(/^(\d{1,4}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (m) return +m[1] * 3600 + +m[2] * 60 + +(m[3] ?? 0);
  const n = Number(s.replace(",", "."));
  if (Number.isFinite(n)) return n <= 2 ? Math.round(n * 86400) : Math.round(n);
  return null;
}

export interface SheetPreview {
  sheetName: string;
  headers: string[];
  rows: Record<string, unknown>[];
}

export async function readWorkbook(file: File): Promise<XLSX.WorkBook> {
  const buf = await file.arrayBuffer();
  return XLSX.read(buf, { type: "array", cellDates: true });
}

function pickSheet(wb: XLSX.WorkBook, wanted: string[]): string {
  for (const w of wanted) {
    const found = wb.SheetNames.find((n) => normKey(n) === normKey(w));
    if (found) return found;
  }
  return wb.SheetNames[0];
}

export function sheetRows(wb: XLSX.WorkBook, sheetName: string): Record<string, unknown>[] {
  const ws = wb.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null, raw: true });
}

const findCol = (headers: string[], candidates: string[]) =>
  headers.find((h) => candidates.some((c) => normKey(h) === normKey(c))) ??
  headers.find((h) => candidates.some((c) => normKey(h).includes(normKey(c)))) ??
  null;

/** Banco 1/3 — Controle Geral de RGs (aba BD-SCHED). */
export function parseRgsSheet(wb: XLSX.WorkBook): { rows: DobraRg[]; sheetName: string; unknownCols: string[] } {
  const sheetName = pickSheet(wb, ["BD-SCHED", "BD SCHED", "RGS", "CONTROLE RG"]);
  const raw = sheetRows(wb, sheetName);
  const headers = raw.length ? Object.keys(raw[0]) : [];
  const c = {
    status: findCol(headers, ["Status"]),
    rg: findCol(headers, ["Nº RG", "N RG", "RG"]),
    fpp: findCol(headers, ["Nº Pacote", "Pacote", "FPP", "FPG"]),
    cliente: findCol(headers, ["Cliente"]),
    ov: findCol(headers, ["Nr. OV", "Nr OV", "OV"]),
    dataRg: findCol(headers, ["Data RG"]),
    produto: findCol(headers, ["Produto"]),
    item: findCol(headers, ["Item OV", "Item"]),
    tarefa: findCol(headers, ["Tarefa Descrição", "Tarefa"]),
    operador: findCol(headers, ["Nome Operador", "Operador"]),
    maquina: findCol(headers, ["Maquina Ativa", "Máquina"]),
    plan: findCol(headers, ["Data Planejamento", "Data Plan"]),
    concl: findCol(headers, ["Data de Conclusão", "Data Conclusão"]),
    tempo: findCol(headers, ["Tempo"]),
  };
  const used = new Set(Object.values(c).filter(Boolean) as string[]);
  const rows: DobraRg[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    const rgRaw = c.rg ? cellStr(r[c.rg]) : null;
    if (!rgRaw) continue;
    const key = normKey(rgRaw);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const fppRaw = c.fpp ? cellStr(r[c.fpp]) : null;
    rows.push({
      rg_key: key,
      rg: displayCode(rgRaw),
      fpp_key: fppRaw ? normKey(fppRaw) : null,
      fpp: fppRaw ? displayCode(fppRaw) : null,
      status: c.status ? cellStr(r[c.status]) : null,
      cliente: c.cliente ? cellStr(r[c.cliente]) : null,
      nr_ov: c.ov ? cellStr(r[c.ov]) : null,
      data_rg: c.dataRg ? cellDate(r[c.dataRg]) : null,
      produto: c.produto ? cellStr(r[c.produto]) : null,
      item_ov: c.item ? cellStr(r[c.item]) : null,
      tarefa_desc: c.tarefa ? cellStr(r[c.tarefa]) : null,
      operador: c.operador ? cellStr(r[c.operador]) : null,
      maquina_ativa: c.maquina ? cellStr(r[c.maquina]) : null,
      data_planejamento: c.plan ? cellDate(r[c.plan]) : null,
      data_conclusao: c.concl ? cellDate(r[c.concl]) : null,
      tempo_seg: c.tempo ? cellSec(r[c.tempo]) : null,
    });
  }
  return { rows, sheetName, unknownCols: headers.filter((h) => !used.has(h) && !/^Column\d+$/i.test(h)) };
}

/** Banco 2 — Informações das FPPs (aba BD-DADOS-DOBRA). */
export function parseFppsSheet(wb: XLSX.WorkBook): { rows: DobraFpp[]; sheetName: string; unknownCols: string[] } {
  const sheetName = pickSheet(wb, ["BD-DADOS-DOBRA", "BD DADOS DOBRA", "FPPS", "DADOS"]);
  const raw = sheetRows(wb, sheetName);
  const headers = raw.length ? Object.keys(raw[0]) : [];
  const c = {
    fpp: findCol(headers, ["FPP/ENC", "FPP", "Pacote"]),
    dtProg: findCol(headers, ["DT PROGRAMADA"]),
    seq: findCol(headers, ["SEQ"]),
    produto: findCol(headers, ["PRODUTO"]),
    linha: findCol(headers, ["LINHA"]),
    cliente: findCol(headers, ["CLIENTE"]),
    item: findCol(headers, ["ITEM"]),
    dataRg: findCol(headers, ["DATA DO RG"]),
    dtPacote: findCol(headers, ["DT DO PACOTE"]),
    dtFim: findCol(headers, ["DT FIM PROGRAMAÇÃO"]),
    dtPlan: findCol(headers, ["DT PLANEJAMENTO"]),
    tempo: findCol(headers, ["TEMPO POR FPP", "TEMPO"]),
    maquina: findCol(headers, ["MAQUINA"]),
  };
  const used = new Set(Object.values(c).filter(Boolean) as string[]);
  const map = new Map<string, DobraFpp>();
  for (const r of raw) {
    const fppRaw = c.fpp ? cellStr(r[c.fpp]) : null;
    if (!fppRaw) continue;
    const key = normKey(fppRaw);
    if (!key) continue;
    const seqN = c.seq ? Number(cellStr(r[c.seq])) : NaN;
    const maqN = c.maquina ? Number(cellStr(r[c.maquina])) : NaN;
    map.set(key, {
      fpp_key: key,
      fpp: displayCode(fppRaw),
      dt_programada: c.dtProg ? cellDate(r[c.dtProg]) : null,
      seq: Number.isFinite(seqN) ? Math.round(seqN) : null,
      produto: c.produto ? cellStr(r[c.produto]) : null,
      linha: c.linha ? cellStr(r[c.linha]) : null,
      cliente: c.cliente ? cellStr(r[c.cliente]) : null,
      item: c.item ? cellStr(r[c.item]) : null,
      data_rg: c.dataRg ? cellDate(r[c.dataRg]) : null,
      dt_pacote: c.dtPacote ? cellDate(r[c.dtPacote]) : null,
      dt_fim_prog: c.dtFim ? cellDate(r[c.dtFim]) : null,
      dt_planejamento: c.dtPlan ? cellDate(r[c.dtPlan]) : null,
      tempo_fpp_seg: c.tempo ? cellSec(r[c.tempo]) : null,
      maquina: Number.isFinite(maqN) ? Math.round(maqN) : null,
    });
  }
  return {
    rows: Array.from(map.values()),
    sheetName,
    unknownCols: headers.filter((h) => !used.has(h) && !/^Column\d+$/i.test(h)),
  };
}

/* ------------------------------------------------------------------ */
/* Hooks de dados                                                      */
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

export const useDobraRgs = () =>
  useQuery({ queryKey: ["dobra_rgs"], queryFn: () => pageAll<DobraRg>("dobra_rgs", "created_at") });

export const useDobraFpps = () =>
  useQuery({ queryKey: ["dobra_fpps"], queryFn: () => pageAll<DobraFpp>("dobra_fpps", "created_at") });

export const useDobraImports = () =>
  useQuery({
    queryKey: ["dobra_imports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dobra_imports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });

export const DEFAULT_CAPACIDADE: Capacidade = {
  horasDiaDobra: "15:54:00",
  turno1: "07:48:00",
  turno2: "08:06:00",
  dobradeiras: 6,
  feriasT1: 0,
  feriasT2: 0,
  afastadosT1: 0,
  afastadosT2: 0,
  manual: false,
  capacidadeManual: "95:36:00",
  obs: "",
};

export const DEFAULT_META: MetaParams = {
  metaRgsDia: 40,
  periodoMedia: 7,
  ignorarFimDeSemana: true,
  somenteDiasComProducao: true,
  metaSla: 95,
};

export const DEFAULT_TAREFAS = ["Dobrar", "Dobra", "Dobrar raio", "Dobrar acabamento"];

/** Ajustes de tempo da dobra: acréscimo percentual e dificuldade por produto. */
export interface AjusteDobra {
  /** Percentual aplicado sobre o tempo estimado (padrão 28%). */
  fatorPct: number;
  /** produto (normalizado) -> nível de dificuldade 1..5 */
  dificuldade: Record<string, number>;
}

export const DEFAULT_AJUSTE: AjusteDobra = { fatorPct: 28, dificuldade: {} };

/** Multiplicador de tempo por nível de dificuldade (3 = normal). */
export const DIFICULDADE_FATOR: Record<number, number> = {
  1: 0.8,
  2: 0.9,
  3: 1,
  4: 1.15,
  5: 1.3,
};

export const DIFICULDADE_LABEL: Record<number, string> = {
  1: "Muito fácil",
  2: "Fácil",
  3: "Normal",
  4: "Difícil",
  5: "Muito difícil",
};


export function useDobraSettings() {
  return useQuery({
    queryKey: ["dobra_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("dobra_settings").select("*");
      if (error) throw error;
      const get = <T,>(k: string, fb: T): T => {
        const row = (data ?? []).find((d) => d.key === k);
        return row ? (row.value as T) : fb;
      };
      return {
        capacidade: { ...DEFAULT_CAPACIDADE, ...get<Partial<Capacidade>>("capacidade", {}) } as Capacidade,
        meta: { ...DEFAULT_META, ...get<Partial<MetaParams>>("meta", {}) } as MetaParams,
        tarefas: get<string[]>("tarefas_dobra", DEFAULT_TAREFAS),
        ajuste: { ...DEFAULT_AJUSTE, ...get<Partial<AjusteDobra>>("ajuste_dobra", {}) } as AjusteDobra,
      };
    },
  });
}

export async function saveSetting(key: string, value: unknown) {
  const { error } = await supabase.from("dobra_settings").upsert({ key, value } as never, { onConflict: "key" });
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/* Regras de negócio                                                   */
/* ------------------------------------------------------------------ */

export interface RgCalc extends DobraRg {
  situacao: Situacao;
  atrasada: boolean;
  /** nível de dificuldade da dobra aplicado ao produto (1..5) */
  dificuldade: number;
  tempoEstimadoSeg: number;
  /**
   * A coluna "Tempo" da planilha BD-SCHED guarda a HORA do dia em que a RG foi
   * concluída (0..23:59), não a duração da tarefa. Por isso ela nunca entra em
   * somatórios de horas produzidas — é exibida apenas como hora de conclusão.
   */
  horaConclusaoSeg: number | null;
  totalRgsFpp: number;
  rgsRestantesFpp: number;
  horasRestantesFppSeg: number;
  tempoFppSeg: number;
}

const isConcluida = (s: string | null) => normKey(s).startsWith("CONCLUID");
const isLogistica = (s: string | null) => normKey(s).includes("LOGISTICA");
const isSeparacao = (s: string | null) => normKey(s).includes("SEPARACAO");
const isEmProducao = (s: string | null) => normKey(s).includes("EMPRODUCAO") || normKey(s).includes("PRODUCAO");
/** RG já passou pela dobra (concluída, logística interna ou separação). */
const jaDobrada = (s: string | null) => isConcluida(s) || isLogistica(s) || isSeparacao(s);

export function buildRgCalc(
  rgs: DobraRg[],
  fpps: DobraFpp[],
  tarefasDobra: string[],
  ajuste: AjusteDobra = DEFAULT_AJUSTE,
): RgCalc[] {
  const tarefaSet = new Set(tarefasDobra.map(normKey));
  const fppMap = new Map(fpps.map((f) => [f.fpp_key, f]));
  const totalPorFpp = new Map<string, number>();
  const abertoPorFpp = new Map<string, number>();
  for (const r of rgs) {
    if (!r.fpp_key) continue;
    totalPorFpp.set(r.fpp_key, (totalPorFpp.get(r.fpp_key) ?? 0) + 1);
    if (!jaDobrada(r.status)) abertoPorFpp.set(r.fpp_key, (abertoPorFpp.get(r.fpp_key) ?? 0) + 1);
  }
  const hoje = todayISO();
  const fator = 1 + (Number.isFinite(ajuste.fatorPct) ? ajuste.fatorPct : 0) / 100;
  const dificuldade = ajuste.dificuldade ?? {};

  return rgs.map((r) => {
    const total = r.fpp_key ? (totalPorFpp.get(r.fpp_key) ?? 1) : 1;
    const restantes = r.fpp_key ? (abertoPorFpp.get(r.fpp_key) ?? 0) : 0;
    const tempoFpp = (r.fpp_key ? fppMap.get(r.fpp_key)?.tempo_fpp_seg : null) ?? 0;
    const nivel = dificuldade[normKey(r.produto)] ?? 3;
    const multi = fator * (DIFICULDADE_FATOR[nivel] ?? 1);
    const porRg = (total > 0 ? tempoFpp / total : 0) * multi;

    let situacao: Situacao;
    if (isConcluida(r.status)) situacao = "concluida";
    else if (!r.tarefa_desc || !tarefaSet.has(normKey(r.tarefa_desc))) situacao = "aguardando";
    else if (isEmProducao(r.status)) situacao = "em_producao";
    else situacao = "disponivel";

    return {
      ...r,
      situacao,
      // A RG tem até 23:59 do dia planejado; só fica atrasada a partir do dia seguinte.
      atrasada: situacao !== "concluida" && !!r.data_planejamento && r.data_planejamento.slice(0, 10) < hoje,
      dificuldade: nivel,
      tempoEstimadoSeg: Math.round(porRg),
      horaConclusaoSeg: situacao === "concluida" ? r.tempo_seg : null,
      totalRgsFpp: total,
      rgsRestantesFpp: restantes,
      horasRestantesFppSeg: Math.round(porRg * restantes),
      tempoFppSeg: tempoFpp,
    };
  });
}

export const SITUACAO_ORDER: Situacao[] = ["em_producao", "disponivel", "aguardando", "concluida"];

export function sortEmAberto(rows: RgCalc[]): RgCalc[] {
  return [...rows].sort((a, b) => {
    if (a.atrasada !== b.atrasada) return a.atrasada ? -1 : 1;
    const oa = SITUACAO_ORDER.indexOf(a.situacao);
    const ob = SITUACAO_ORDER.indexOf(b.situacao);
    if (oa !== ob) return oa - ob;
    return (a.data_planejamento ?? "9999").localeCompare(b.data_planejamento ?? "9999");
  });
}

export interface FppCalc {
  fpp_key: string;
  fpp: string;
  produto: string | null;
  dt_planejamento: string | null;
  tempoTotalSeg: number;
  total: number;
  concluidas: number;
  emProducao: number;
  disponiveis: number;
  aguardando: number;
  atrasadas: number;
  tempoConcluidoSeg: number;
  tempoRestanteSeg: number;
  pctConcluido: number;
  prazo: "Atrasada" | "Hoje" | "Amanhã" | "Dentro do prazo" | "Concluída" | "—";
}

export function buildFppCalc(rgs: RgCalc[], fpps: DobraFpp[]): FppCalc[] {
  const hoje = todayISO();
  const amanha = addDaysISO(hoje, 1);
  const fppMap = new Map(fpps.map((f) => [f.fpp_key, f]));
  const groups = new Map<string, RgCalc[]>();
  for (const r of rgs) {
    if (!r.fpp_key) continue;
    const arr = groups.get(r.fpp_key) ?? [];
    arr.push(r);
    groups.set(r.fpp_key, arr);
  }
  return Array.from(groups.entries()).map(([key, list]) => {
    const meta = fppMap.get(key);
    const total = list.length;
    const porRg = list[0]?.tempoEstimadoSeg ?? 0;
    const concluidas = list.filter((r) => r.situacao === "concluida").length;
    const abertas = list.filter((r) => r.situacao !== "concluida");
    const atrasadas = abertas.filter((r) => r.atrasada).length;
    // Prazo da FPP = prazo das RGs que ainda estão abertas (o da planilha pode
    // estar vencido mesmo com todas as RGs restantes dentro do prazo).
    const prazoAberto = abertas
      .map((r) => (r.data_planejamento ?? "").slice(0, 10))
      .filter(Boolean)
      .sort()[0] ?? null;
    const plan = prazoAberto ?? meta?.dt_planejamento ?? list.find((r) => r.data_planejamento)?.data_planejamento ?? null;
    const restante = total - concluidas;
    let prazo: FppCalc["prazo"] = "—";
    if (restante === 0) prazo = "Concluída";
    else if (atrasadas > 0) prazo = "Atrasada";
    else if (prazoAberto === hoje) prazo = "Hoje";
    else if (prazoAberto === amanha) prazo = "Amanhã";
    else if (prazoAberto) prazo = "Dentro do prazo";
    return {
      fpp_key: key,
      fpp: list[0]?.fpp ?? displayCode(key),
      produto: meta?.produto ?? list[0]?.produto ?? null,
      dt_planejamento: plan,
      tempoTotalSeg: meta?.tempo_fpp_seg ?? porRg * total,
      total,
      concluidas,
      emProducao: list.filter((r) => r.situacao === "em_producao").length,
      disponiveis: list.filter((r) => r.situacao === "disponivel").length,
      aguardando: list.filter((r) => r.situacao === "aguardando").length,
      atrasadas,
      tempoConcluidoSeg: Math.round(porRg * concluidas),
      tempoRestanteSeg: Math.round(porRg * restante),
      pctConcluido: total ? (concluidas / total) * 100 : 0,
      prazo,
    };
  });
}


export function capacidadeTotalSeg(c: Capacidade): number {
  if (c.manual) return hmsToSec(c.capacidadeManual);
  const pessoasT1 = Math.max(0, c.dobradeiras - c.feriasT1 - c.afastadosT1);
  const pessoasT2 = Math.max(0, c.dobradeiras - c.feriasT2 - c.afastadosT2);
  return hmsToSec(c.turno1) * pessoasT1 + hmsToSec(c.turno2) * pessoasT2;
}

/* ------------------------------------------------------------------ */
/* Séries de produção e carga (compartilhadas dashboard/widgets)       */
/* ------------------------------------------------------------------ */

export interface ProducaoDia {
  [k: string]: string | number;
  iso: string;
  label: string;
  rgs: number;
  pecas: number;
  horas: number;
}

/** Produção da dobra por dia de conclusão. `pecasPorRg` vem do BD-CONTROLE-RG. */
export function buildProducaoDiaria(
  concluidas: RgCalc[],
  pecasPorRg: Map<string, number> = new Map(),
  dias = 14,
): ProducaoDia[] {
  const map = new Map<string, { rgs: number; pecas: number; horas: number }>();
  for (const r of concluidas) {
    const d = (r.data_conclusao ?? "").slice(0, 10);
    if (!d) continue;
    const cur = map.get(d) ?? { rgs: 0, pecas: 0, horas: 0 };
    cur.rgs += 1;
    cur.pecas += pecasPorRg.get(r.rg_key) ?? 0;
    cur.horas += r.tempoEstimadoSeg / 3600;
    map.set(d, cur);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-dias)
    .map(([iso, v]) => ({
      iso,
      label: fmtBrDate(iso).slice(0, 5),
      rgs: v.rgs,
      pecas: Math.round(v.pecas),
      horas: Number(v.horas.toFixed(1)),
    }));
}

export interface CargaDia {
  [k: string]: string | number;
  iso: string;
  label: string;
  horas: number;
  capacidade: number;
  util: number;
  rgs: number;
  fpps: number;
  saldo: number;
}

/**
 * Carga da dobra por dia. O primeiro dia acumula tudo que está atrasado ou
 * sem data de planejamento, senão o gráfico ficaria vazio quando a planilha
 * só traz datas passadas.
 */
export function buildCargaDiaria(abertas: RgCalc[], capSeg: number, dias = 7): CargaDia[] {
  const hoje = todayISO();
  const capH = capSeg / 3600;
  const datas = Array.from({ length: dias }, (_, i) => addDaysISO(hoje, i));
  const ultimo = datas[datas.length - 1];
  return datas.map((d, idx) => {
    const list = abertas.filter((r) => {
      const p = (r.data_planejamento ?? "").slice(0, 10);
      if (idx === 0) return !p || p <= d;
      if (d === ultimo) return p >= d;
      return p === d;
    });
    const horas = list.reduce((s, r) => s + r.tempoEstimadoSeg, 0) / 3600;
    return {
      iso: d,
      label: fmtBrDate(d).slice(0, 5),
      horas: Number(horas.toFixed(1)),
      capacidade: Number(capH.toFixed(1)),
      util: capH ? Number(((horas / capH) * 100).toFixed(1)) : 0,
      saldo: Number((capH - horas).toFixed(1)),
      rgs: list.length,
      fpps: new Set(list.map((r) => r.fpp_key).filter(Boolean)).size,
    };
  });
}
