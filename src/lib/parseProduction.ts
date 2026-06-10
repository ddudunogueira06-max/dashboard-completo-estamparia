import * as XLSX from "xlsx";

export interface ProductionRow {
  fpp: string | null;
  dt_prog: string | null;
  seq: number | null;
  produto: string | null;
  linha: string | null;
  cliente: string | null;
  item: string | null;
  data_rg: string | null;
  dt_pacote: string | null;
  dt_fim_prog: string | null;
  dt_fim_estamparia: string | null;
  dt_fim_agrup: string | null;
  tempo_fpp_seg: number | null;
  maquina: number | null;
  tempo_execucao_seg: number | null;
}

function toStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" || s.toUpperCase() === "N/A" ? null : s;
}
function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
function toDate(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v.toISOString();
  if (typeof v === "number") {
    // dates with cellDates are usually Date objects; numbers > 1 = dates
    if (v > 1) {
      const d = XLSX.SSF.parse_date_code(v);
      if (d) return new Date(Date.UTC(d.y, d.m - 1, d.d, d.H || 0, d.M || 0, Math.floor(d.S || 0))).toISOString();
    }
    return null;
  }
  if (typeof v === "string") {
    const s = v.trim();
    if (!s || s.toUpperCase() === "N/A") return null;
    // dd/mm/yyyy
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])).toISOString();
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}
function toSeconds(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) {
    // XLSX com cellDates cria Date no fuso LOCAL com os mesmos componentes mostrados
    // na célula (ex.: "06:05:30" → new Date(1899,11,30,6,5,30) local).
    // Usar getHours/getMinutes/getSeconds preserva o valor exibido sem distorção de fuso.
    return v.getHours() * 3600 + v.getMinutes() * 60 + v.getSeconds();
  }
  if (typeof v === "number") {
    // -1 sentinel = not done
    if (v < 0) return Math.round(v);
    // fraction of day
    if (v <= 2) return Math.round(v * 86400);
    return Math.round(v);
  }
  if (typeof v === "string") {
    const s = v.trim();
    if (!s || s.toUpperCase() === "N/A") return null;
    const m = s.match(/^(\d{1,3}):(\d{2})(?::(\d{2}))?$/);
    if (m) return (+m[1]) * 3600 + (+m[2]) * 60 + (+(m[3] ?? 0));
    const n = Number(s);
    if (Number.isFinite(n)) {
      if (n < 0) return Math.round(n);
      return n <= 2 ? Math.round(n * 86400) : Math.round(n);
    }
  }
  return null;
}

export async function parseProductionFile(file: File): Promise<ProductionRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames.includes("BASE") ? "BASE" : wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, blankrows: false });
  if (aoa.length < 2) return [];

  // Fixed columns: A..P
  const rows: ProductionRow[] = [];
  for (let r = 1; r < aoa.length; r++) {
    const row = aoa[r];
    if (!row || row.length === 0) continue;
    const fpp = toStr(row[0]);
    if (!fpp) continue;
    rows.push({
      fpp,
      dt_prog: toDate(row[1]),
      seq: toNum(row[2]) === null ? null : Math.round(toNum(row[2])!),
      produto: toStr(row[3]),
      linha: toStr(row[4]),
      cliente: toStr(row[5]),
      item: toStr(row[6]),
      data_rg: toDate(row[7]),
      dt_pacote: toDate(row[9]),
      dt_fim_prog: toDate(row[10]),
      dt_fim_estamparia: toDate(row[11]),
      dt_fim_agrup: toDate(row[12]),
      tempo_fpp_seg: toSeconds(row[13]),
      maquina: toNum(row[14]) === null ? null : Math.round(toNum(row[14])!),
      tempo_execucao_seg: toSeconds(row[15]),
    });
  }
  return rows;
}
