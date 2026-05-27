import * as XLSX from "xlsx";

export interface WasteRow {
  tipo: string | null;
  numero: number | null;
  codigo_item: string | null;
  descricao: string | null;
  armazem: string | null;
  fator_perda: number | null;
  linha: number | null;
  qtde_solicitada: number | null;
  data_registro: string | null;
  retalho: number | null;
  status: string | null;
}

const KEYS = {
  tipo: ["tipo"],
  numero: ["número", "numero", "nº", "n°"],
  codigo_item: ["código do item", "codigo do item", "código", "codigo"],
  descricao: ["descrição", "descricao", "descrição do item", "descricao do item"],
  armazem: ["armazém", "armazem"],
  fator_perda: ["fator de perda (%)", "fator de perda", "fator perda"],
  linha: ["linha"],
  qtde_solicitada: ["qtde. solicitada (m²)", "qtde solicitada", "quantidade solicitada (m²)", "quantidade solicitada"],
  data_registro: ["data de registro", "data do registro", "data"],
  retalho: ["retalho (m²)", "retalho"],
  status: ["status"],
};

function norm(s: string) {
  return s.toString().trim().toLowerCase();
}

function findKey(row: Record<string, unknown>, candidates: string[]): string | undefined {
  const map = new Map(Object.keys(row).map((k) => [norm(k), k]));
  for (const c of candidates) {
    const found = map.get(norm(c));
    if (found) return found;
  }
  return undefined;
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function toDate(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return new Date(Date.UTC(d.y, d.m - 1, d.d, d.H || 0, d.M || 0, Math.floor(d.S || 0))).toISOString();
  }
  const parsed = new Date(String(v));
  return isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export async function parseExcelFile(file: File): Promise<WasteRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  // Prefer "BD" sheet, else first
  const sheetName = wb.SheetNames.includes("BD") ? "BD" : wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });

  if (json.length === 0) return [];

  const sample = json[0];
  const keyMap: Record<keyof WasteRow, string | undefined> = {
    tipo: findKey(sample, KEYS.tipo),
    numero: findKey(sample, KEYS.numero),
    codigo_item: findKey(sample, KEYS.codigo_item),
    descricao: findKey(sample, KEYS.descricao),
    armazem: findKey(sample, KEYS.armazem),
    fator_perda: findKey(sample, KEYS.fator_perda),
    linha: findKey(sample, KEYS.linha),
    qtde_solicitada: findKey(sample, KEYS.qtde_solicitada),
    data_registro: findKey(sample, KEYS.data_registro),
    retalho: findKey(sample, KEYS.retalho),
    status: findKey(sample, KEYS.status),
  };

  return json.map((r) => ({
    tipo: keyMap.tipo ? (r[keyMap.tipo] as string | null) : null,
    numero: keyMap.numero ? toNum(r[keyMap.numero]) : null,
    codigo_item: keyMap.codigo_item ? (r[keyMap.codigo_item] as string | null) : null,
    descricao: keyMap.descricao ? (r[keyMap.descricao] as string | null) : null,
    armazem: keyMap.armazem ? (r[keyMap.armazem] as string | null) : null,
    fator_perda: keyMap.fator_perda ? toNum(r[keyMap.fator_perda]) : null,
    linha: keyMap.linha ? (toNum(r[keyMap.linha]) as number | null) : null,
    qtde_solicitada: keyMap.qtde_solicitada ? toNum(r[keyMap.qtde_solicitada]) : null,
    data_registro: keyMap.data_registro ? toDate(r[keyMap.data_registro]) : null,
    retalho: keyMap.retalho ? toNum(r[keyMap.retalho]) : null,
    status: keyMap.status ? (r[keyMap.status] as string | null) : null,
  })).filter((r) => r.codigo_item || r.numero);
}

export function exportToCSV(rows: Record<string, unknown>[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportToXLSX(rows: Record<string, unknown>[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Dados");
  XLSX.writeFile(wb, filename);
}
