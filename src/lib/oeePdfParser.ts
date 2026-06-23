import * as pdfjsLib from "pdfjs-dist";
// Vite resolves this to a static URL for the worker bundle
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const MES_MAP: Record<string, number> = {
  JAN: 1, FEV: 2, MAR: 3, ABR: 4, MAI: 5, MAIO: 5, JUN: 6, JUL: 7,
  AGO: 8, SET: 9, OUT: 10, NOV: 11, DEZ: 12,
};

export interface OeeParsedDia {
  data: string; // YYYY-MM-DD
  horas_disp_seg: number;
  horas_prog_seg: number;
  horas_reg_seg: number;
  paradas_prog_seg: number;
  paradas_nao_prog_seg: number;
  oee: number | null;
}
export interface OeeParsedParada {
  categoria: string;
  total_seg: number;
}
export interface OeeParsedFile {
  filename: string;
  turno: 1 | 2;
  maquina: number;
  mes_ref: string; // YYYY-MM-01
  dias: OeeParsedDia[];
  paradas: OeeParsedParada[];
}

function hmsToSeg(s: string): number {
  const m = s.match(/^(\d{1,3}):(\d{2}):(\d{2})$/);
  if (!m) return 0;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

function pctToNum(s: string): number | null {
  const m = s.match(/(\d{1,3}),(\d{1,2})/);
  if (!m) return null;
  return Number(`${m[1]}.${m[2]}`);
}

function parseFilename(name: string): { turno: 1 | 2; maquina: number; mes_ref: string } {
  // ex: "1º 2000 MAIO.pdf" / "2º_3000_MAIO.pdf"
  const base = name.replace(/\.pdf$/i, "");
  const norm = base.replace(/[_\s]+/g, " ").trim().toUpperCase();
  const m = norm.match(/^([12])[ºO]\s+(\d{3,4})\s+([A-ZÇ]+)(?:\s+(\d{4}))?$/);
  if (!m) {
    throw new Error(`Nome do arquivo fora do padrão "<turno>º <máquina> <MÊS> [ano].pdf": ${name}`);
  }
  const turno = Number(m[1]) as 1 | 2;
  const maquina = Number(m[2]);
  const mesNum = MES_MAP[m[3]];
  if (!mesNum) throw new Error(`Mês não reconhecido em "${name}"`);
  const ano = m[4] ? Number(m[4]) : new Date().getFullYear();
  const mes_ref = `${ano}-${String(mesNum).padStart(2, "0")}-01`;
  return { turno, maquina, mes_ref };
}

async function extractText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // join items with single space; pdfjs gives us positional items
    const items = content.items as Array<{ str: string }>;
    parts.push(items.map((it) => it.str).join(" "));
  }
  return parts.join("\n");
}

function brDateToIso(br: string): string {
  const [d, m, y] = br.split("/");
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function parseInfoTempo(text: string): Map<string, Omit<OeeParsedDia, "oee">> {
  // capture: DIA - dd/mm/yyyy  h1  h2  h3  h4  h5  pct
  const re = /(?:SEG|TER|QUA|QUI|SEX|S[ÁA]B|DOM)\s*-\s*(\d{2}\/\d{2}\/\d{4})\s+(\d{1,3}:\d{2}:\d{2})\s+(\d{1,3}:\d{2}:\d{2})\s+(\d{1,3}:\d{2}:\d{2})\s+(\d{1,3}:\d{2}:\d{2})\s+(\d{1,3}:\d{2}:\d{2})/g;
  const out = new Map<string, Omit<OeeParsedDia, "oee">>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const iso = brDateToIso(m[1]);
    out.set(iso, {
      data: iso,
      horas_disp_seg: hmsToSeg(m[2]),
      horas_prog_seg: hmsToSeg(m[3]),
      horas_reg_seg: hmsToSeg(m[4]),
      paradas_prog_seg: hmsToSeg(m[5]),
      paradas_nao_prog_seg: hmsToSeg(m[6]),
    });
  }
  return out;
}

function parseOeeDaily(text: string): Map<string, number> {
  // DADOS OEE table: DIA - dd/mm/yyyy  Disp%  Perf%  Qual%  OEE%
  // We capture the 4th percentage as OEE
  const re = /(?:SEG|TER|QUA|QUI|SEX|S[ÁA]B|DOM)\s*-\s*(\d{2}\/\d{2}\/\d{4})\s+(\d{1,3},\d{1,2})\s*%\s+(\d{1,3},\d{1,2})\s*%\s+(\d{1,3},\d{1,2})\s*%\s+(\d{1,3},\d{1,2})\s*%/g;
  const out = new Map<string, number>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const iso = brDateToIso(m[1]);
    const v = pctToNum(m[5]);
    if (v !== null) out.set(iso, v);
  }
  return out;
}

function parseParadas(text: string): OeeParsedParada[] {
  // Find segment between "PARADAS DE MÁQUINA" and the next "Mês"
  const start = text.search(/PARADAS\s+DE\s+M[ÁA]QUINA/i);
  if (start < 0) return [];
  const tail = text.slice(start);
  // line like: "<categoria words> HH:MM:SS"
  const re = /([A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9 .,\-\/()]+?)\s+(\d{1,3}:\d{2}:\d{2})/g;
  const seen = new Set<string>();
  const out: OeeParsedParada[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(tail)) !== null) {
    const cat = m[1].trim();
    // skip header words
    if (/^(Parada de M[áa]quina|Total em Horas|M[êe]s)$/i.test(cat)) continue;
    if (/total em horas/i.test(cat)) continue;
    // Strip leading column labels that may glue to the first item
    const cleanCat = cat.replace(/^.*?(Parada de M[áa]quina|Total em Horas)\s*/i, "").trim();
    const finalCat = cleanCat || cat;
    if (!finalCat || finalCat.length < 2) continue;
    const key = `${finalCat}|${m[2]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ categoria: finalCat, total_seg: hmsToSeg(m[2]) });
    // stop after a "Mês" row appears later
  }
  // Heuristic: keep only entries up to first "Mês" mention after the section
  const mesPos = tail.search(/\bM[êe]s\b/);
  if (mesPos >= 0) {
    // re-run with substring to be safe
    const segText = tail.slice(0, mesPos);
    const cleaned: OeeParsedParada[] = [];
    const seen2 = new Set<string>();
    let mm: RegExpExecArray | null;
    const re2 = new RegExp(re.source, "g");
    while ((mm = re2.exec(segText)) !== null) {
      const c = mm[1].trim().replace(/^.*?(Parada de M[áa]quina|Total em Horas)\s*/i, "").trim();
      if (!c || c.length < 2) continue;
      if (/^(Parada de M[áa]quina|Total em Horas|M[êe]s)$/i.test(c)) continue;
      const k = `${c}|${mm[2]}`;
      if (seen2.has(k)) continue;
      seen2.add(k);
      cleaned.push({ categoria: c, total_seg: hmsToSeg(mm[2]) });
    }
    if (cleaned.length > 0) return cleaned;
  }
  return out;
}

export async function parseOeePdf(file: File): Promise<OeeParsedFile> {
  const meta = parseFilename(file.name);
  const text = await extractText(file);
  const tempo = parseInfoTempo(text);
  const oees = parseOeeDaily(text);
  const dias: OeeParsedDia[] = Array.from(tempo.values()).map((d) => ({
    ...d,
    oee: oees.get(d.data) ?? null,
  }));
  const paradas = parseParadas(text);
  return {
    filename: file.name,
    turno: meta.turno,
    maquina: meta.maquina,
    mes_ref: meta.mes_ref,
    dias,
    paradas,
  };
}
