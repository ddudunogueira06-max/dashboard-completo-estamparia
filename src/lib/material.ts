// Detecta tipo de material e espessura a partir da descrição.
// Exemplos:
//   "CH AISI304#1,5X3000X1240 BB/F1 9" -> inox, 1.5mm
//   "CH GALV#0,9X1200X3000"            -> galvanizado, 0.9mm
//   "CH ALUM#2,0X1000X2000"            -> aluminio, 2.0mm

export type MaterialKind = "inox" | "galvanizado" | "aluminio" | "outro";

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

export function detectMaterial(descricao: string | null | undefined): MaterialKind {
  if (!descricao) return "outro";
  const d = descricao.toUpperCase();
  if (/AISI|INOX|\b30[44]\b|\b316\b|\b430\b/.test(d)) return "inox";
  if (/GALV|\bGI\b|ZINC/.test(d)) return "galvanizado";
  if (/ALUM|\bAL\b/.test(d)) return "aluminio";
  return "outro";
}

// Extrai a espessura (mm) — número após "#" ou primeiro número decimal antes de "X"
export function detectThicknessMm(descricao: string | null | undefined): number | null {
  if (!descricao) return null;
  // após #
  const m1 = descricao.match(/#\s*([\d]+[,.]?[\d]*)/);
  if (m1) {
    const v = parseFloat(m1[1].replace(",", "."));
    if (!isNaN(v) && v > 0 && v < 50) return v;
  }
  // padrão "1,5X3000" ou "1.5X3000"
  const m2 = descricao.match(/(?:^|\s)([\d]+[,.][\d]+)\s*X/i);
  if (m2) {
    const v = parseFloat(m2[1].replace(",", "."));
    if (!isNaN(v) && v > 0 && v < 50) return v;
  }
  return null;
}

// Converte m² em kg usando densidade do material e espessura (mm).
// kg = m² × mm × densidade(g/cm³)
export function m2ToKg(m2: number | null | undefined, descricao: string | null | undefined): number {
  if (!m2) return 0;
  const mat = detectMaterial(descricao);
  const dens = DENSITY[mat];
  const thick = detectThicknessMm(descricao);
  if (!dens || !thick) return 0;
  return m2 * thick * dens;
}
