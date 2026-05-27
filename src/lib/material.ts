// Detecta tipo de material, espessura, acabamento (BB/EB) e variantes (Branca).
// Exemplos:
//   "CH AISI304#1,5X3000X1240 BB/F1 9" -> inox, 1.5mm, BB
//   "CH AISI430 EB #1,2X..."           -> inox, 1.2mm, EB
//   "CH GALV BRANCA #0,9X1200X3000"    -> galvanizado branca, 0.9mm
//   "CH GALV#0,9X1200X3000"            -> galvanizado, 0.9mm
//   "CH ALUM#2,0X1000X2000"            -> aluminio, 2.0mm

export type MaterialKind = "inox" | "galvanizado" | "aluminio" | "outro";
export type InoxFinish = "BB" | "EB" | null;

export const DENSITY: Record<MaterialKind, number> = {
  inox: 7.9,
  galvanizado: 7.86,
  aluminio: 2.7,
  outro: 0,
};

export const MATERIAL_LABEL: Record<MaterialKind, string> = {
  inox: "Inox",
  galvanizado: "Galvanizado",
  aluminio: "Alumínio",
  outro: "Outro",
};

export const MATERIAL_SHORT: Record<MaterialKind, string> = {
  inox: "INOX",
  galvanizado: "GALV",
  aluminio: "AL",
  outro: "OUT",
};

export function fmtThickness(mm: number): string {
  return mm.toFixed(2).replace(".", ",");
}

export function materialThicknessKey(material: MaterialKind, mm: number): string {
  return `${fmtThickness(mm)}-${MATERIAL_SHORT[material]}`;
}
export function materialThicknessLabel(material: MaterialKind, mm: number): string {
  return `${fmtThickness(mm)} ${MATERIAL_SHORT[material]}`;
}

// Categoria para o filtro "Material / Espessura"
// Diferencia INOX BB/EB e GALV BRANCA (CB)
// Ex.: "1,50-INOX BB", "1,20-INOX EB", "0,65-CB", "0,90-GALV", "1,00-AL"
export function filterCategory(descricao: string | null | undefined): { key: string; label: string } | null {
  const mat = detectMaterial(descricao);
  const mm = detectThicknessMm(descricao);
  if (mat === "outro" || !mm) return null;
  const thick = fmtThickness(mm);
  if (mat === "inox") {
    const fin = detectInoxFinish(descricao);
    const suffix = fin ? `INOX ${fin}` : "INOX";
    return { key: `${thick}-INOX-${fin ?? "X"}`, label: `${thick}-${suffix}` };
  }
  if (mat === "galvanizado") {
    const isBr = detectIsBranca(descricao);
    return isBr
      ? { key: `${thick}-CB`, label: `${thick}-CB` }
      : { key: `${thick}-GALV`, label: `${thick}-GALV` };
  }
  return { key: `${thick}-AL`, label: `${thick}-AL` };
}

export function detectMaterial(descricao: string | null | undefined): MaterialKind {
  if (!descricao) return "outro";
  const d = descricao.toUpperCase();
  if (/AISI|INOX|\b304\b|\b316\b|\b430\b/.test(d)) return "inox";
  if (/GALV|\bGI\b|ZINC|BRANC[AO]|\bBR\b/.test(d)) return "galvanizado";
  if (/ALUM|\bAL\b/.test(d)) return "aluminio";
  return "outro";
}

export function detectThicknessMm(descricao: string | null | undefined): number | null {
  if (!descricao) return null;
  const m1 = descricao.match(/#\s*([\d]+[,.]?[\d]*)/);
  if (m1) {
    const v = parseFloat(m1[1].replace(",", "."));
    if (!isNaN(v) && v > 0 && v < 50) return v;
  }
  const m2 = descricao.match(/(?:^|\s)([\d]+[,.][\d]+)\s*X/i);
  if (m2) {
    const v = parseFloat(m2[1].replace(",", "."));
    if (!isNaN(v) && v > 0 && v < 50) return v;
  }
  return null;
}

// Detecta acabamento BB/EB no inox
export function detectInoxFinish(descricao: string | null | undefined): InoxFinish {
  if (!descricao) return null;
  const d = descricao.toUpperCase();
  if (/\bBB\b|BB\//.test(d)) return "BB";
  if (/\bEB\b|EB\//.test(d)) return "EB";
  return null;
}

// Detecta se é "branca" (galvanizado pintado)
export function detectIsBranca(descricao: string | null | undefined): boolean {
  if (!descricao) return false;
  return /BRANC[AO]/i.test(descricao);
}

// Categoria detalhada para a matriz de indicadores
// Ex.: "INOX BB 1,50" | "INOX EB 1,20" | "INOX 1,50" | "GALV BRANCA 0,90" | "GALV 0,65" | "AL 1,00"
export interface DetailedCategory {
  key: string;
  label: string;
  material: MaterialKind;
}
export function detailedCategory(descricao: string | null | undefined): DetailedCategory | null {
  const mat = detectMaterial(descricao);
  const mm = detectThicknessMm(descricao);
  if (mat === "outro" || !mm) return null;
  const thick = fmtThickness(mm);

  if (mat === "inox") {
    const fin = detectInoxFinish(descricao);
    const suffix = fin ? `${fin} ` : "";
    return {
      key: `INOX-${fin ?? "X"}-${thick}`,
      label: `INOX ${suffix}${thick}`,
      material: mat,
    };
  }
  if (mat === "galvanizado") {
    const isBr = detectIsBranca(descricao);
    return {
      key: `GALV-${isBr ? "BR" : "N"}-${thick}`,
      label: `GALV ${isBr ? "BRANCA " : ""}${thick}`,
      material: mat,
    };
  }
  // aluminio
  return {
    key: `AL-${thick}`,
    label: `AL ${thick}`,
    material: mat,
  };
}

// kg = m² × mm × densidade(g/cm³)
export function m2ToKg(m2: number | null | undefined, descricao: string | null | undefined): number {
  if (!m2) return 0;
  const mat = detectMaterial(descricao);
  const dens = DENSITY[mat];
  const thick = detectThicknessMm(descricao);
  if (!dens || !thick) return 0;
  return m2 * thick * dens;
}
