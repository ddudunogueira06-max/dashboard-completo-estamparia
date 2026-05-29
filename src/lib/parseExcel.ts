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

function norm(s: unknown) {
  return (s ?? "").toString().trim().toLowerCase();
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
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return new Date(Date.UTC(d.y, d.m - 1, d.d, d.H || 0, d.M || 0, Math.floor(d.S || 0))).toISOString();
  }
  const parsed = new Date(String(v));
  return isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function toStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/** Build positional column index from the header row, supporting both
 *  the new layout (merged "Item" header spanning code+description) and
 *  the older labeled layout. */
function buildIndexMap(header: unknown[]): Record<keyof WasteRow, number> {
  const idx: Record<keyof WasteRow, number> = {
    tipo: -1, numero: -1, codigo_item: -1, descricao: -1, armazem: -1,
    fator_perda: -1, linha: -1, qtde_solicitada: -1, data_registro: -1,
    retalho: -1, status: -1,
  };
  const H = header.map(norm);
  const findOne = (...names: string[]) => {
    for (const n of names) {
      const i = H.indexOf(n);
      if (i >= 0) return i;
    }
    return -1;
  };

  idx.tipo = findOne("tipo");
  idx.numero = findOne("número", "numero", "nº", "n°");
  idx.armazem = findOne("armazém", "armazem");
  idx.fator_perda = findOne("fator de perda (%)", "fator de perda", "fator perda");
  idx.linha = findOne("linha");
  idx.qtde_solicitada = findOne("qtde. solicitada (m²)", "quantidade solicitada (m²)", "quantidade solicitada", "qtde solicitada");
  idx.data_registro = findOne("data de registro", "data do registro", "data");
  idx.retalho = findOne("retalho (m²)", "retalho");
  idx.status = findOne("status");
  idx.codigo_item = findOne("código do item", "codigo do item", "código", "codigo");
  idx.descricao = findOne("descrição", "descricao", "descrição do item", "descricao do item");

  // New layout: "Item" header merged across 3 cells → code at +1, descr at +2
  if (idx.codigo_item < 0 || idx.descricao < 0) {
    const itemIdx = H.indexOf("item");
    if (itemIdx >= 0) {
      if (idx.codigo_item < 0) idx.codigo_item = itemIdx + 1;
      if (idx.descricao < 0) idx.descricao = itemIdx + 2;
    }
  }
  return idx;
}

export async function parseExcelFile(file: File): Promise<WasteRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames.includes("BD") ? "BD" : wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, blankrows: false });
  if (aoa.length < 2) return [];

  const idx = buildIndexMap(aoa[0]);
  const get = (row: unknown[], i: number) => (i >= 0 ? row[i] : null);

  const rows: WasteRow[] = [];
  for (let r = 1; r < aoa.length; r++) {
    const row = aoa[r];
    if (!row || row.length === 0) continue;
    const wr: WasteRow = {
      tipo: toStr(get(row, idx.tipo)),
      numero: toNum(get(row, idx.numero)),
      codigo_item: toStr(get(row, idx.codigo_item)),
      descricao: toStr(get(row, idx.descricao)),
      armazem: toStr(get(row, idx.armazem)),
      fator_perda: toNum(get(row, idx.fator_perda)),
      linha: toNum(get(row, idx.linha)),
      qtde_solicitada: toNum(get(row, idx.qtde_solicitada)),
      data_registro: toDate(get(row, idx.data_registro)),
      retalho: toNum(get(row, idx.retalho)),
      status: toStr(get(row, idx.status)),
    };
    if (wr.codigo_item || wr.numero) rows.push(wr);
  }
  return rows;
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
