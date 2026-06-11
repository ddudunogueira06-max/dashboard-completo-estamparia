import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fmtNum, fmtInt, fmtPct } from "@/lib/format";
import { MATERIAL_LABEL, type MaterialKind } from "@/lib/material";

export interface ReportRecord {
  tipo: string | null;
  numero: number | null;
  codigo_item: string | null;
  descricao: string | null;
  armazem: string | null;
  fator_perda: number | null;
  linha: number | null;
  data_registro: string | null;
  status: string | null;
  material: MaterialKind;
  matLabel: string;
  detLabel: string;
  qtde_m2: number;
  retalho_m2: number;
  qtde_kg: number;
  retalho_kg: number;
}

interface Totals {
  solic_kg: number;
  desp_kg: number;
  proc_kg: number;
  retalho_kg: number;
  solic_m2: number;
  desp_m2: number;
  proc_m2: number;
  retalho_m2: number;
  mediaPerda: number;
  itens: number;
  fpps: number;
  registros: number;
}

const MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

// Material accent colors (RGB) — alinhados ao dashboard
const MAT_COLOR: Record<MaterialKind, [number, number, number]> = {
  inox: [99, 179, 237],
  galvanizado: [251, 191, 36],
  aluminio: [167, 139, 250],
  outro: [148, 163, 184],
};

const META: Record<Exclude<MaterialKind, "outro">, number> = {
  galvanizado: 13,
  aluminio: 24,
  inox: 27,
};

// === MESMA FONTE ÚNICA DO DASHBOARD ===
// Média ARITMÉTICA SIMPLES dos fatores de perda (coluna O), com dedupe:
// mesma FPP + mesma espessura/material + mesmo fator = conta 1×. Sem ponderação por peso.
function uniqueFatores(rows: ReportRecord[]): number[] {
  const seen = new Set<string>();
  const out: number[] = [];
  rows.forEach((r, i) => {
    if (r.fator_perda === null) return;
    const fppId = r.numero !== null ? `${(r.tipo ?? "").toUpperCase()}|${r.numero}` : `__row__|${i}`;
    const k = `${fppId}|${r.detLabel}|${r.fator_perda}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push(r.fator_perda);
  });
  return out;
}
function meanOf(arr: number[]): number | null {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
}

export function generateWasteReportPDF(records: ReportRecord[], totals: Totals, filtroResumo: string) {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 36;

  // ============================================================
  // PÁGINA 1 — Resumo executivo + por material + top 10
  // ============================================================
  let y = margin;

  // Header
  doc.setFillColor(20, 28, 48);
  doc.rect(0, 0, pageW, 70, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Relatório de Materiais e Desperdícios", margin, 32);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, margin, 50);
  doc.text(filtroResumo, margin, 62);
  y = 90;

  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Resumo Executivo", margin, y);

  autoTable(doc, {
    startY: y + 8,
    head: [["Indicador", "Valor (kg)", "Valor (m²)"]],
    body: [
      ["Total Solicitado", fmtNum(totals.solic_kg), fmtNum(totals.solic_m2)],
      ["Total Processado", fmtNum(totals.proc_kg), fmtNum(totals.proc_m2)],
      ["Desperdício Total", fmtNum(totals.desp_kg), fmtNum(totals.desp_m2)],
      ["Retalho Total", fmtNum(totals.retalho_kg), fmtNum(totals.retalho_m2)],
      ["Média de Perda (média simples)", fmtPct(totals.mediaPerda), "—"],
      ["Quantidade de Itens Únicos", fmtInt(totals.itens), "—"],
      ["Total de FPPs", fmtInt(totals.fpps), "—"],
      ["Total de Registros", fmtInt(totals.registros), "—"],
    ],
    theme: "striped",
    headStyles: { fillColor: [30, 64, 110], textColor: 255, fontSize: 10 },
    bodyStyles: { fontSize: 10 },
    margin: { left: margin, right: margin },
  });
  // @ts-expect-error
  y = doc.lastAutoTable.finalY + 20;

  // Resumo por material — Média % = média simples (uniqueFatores), igual ao dashboard
  const matAgg = new Map<MaterialKind, { kg: number; m2: number; desp_kg: number; desp_m2: number; rows: ReportRecord[] }>();
  records.forEach(r => {
    const cur = matAgg.get(r.material) ?? { kg: 0, m2: 0, desp_kg: 0, desp_m2: 0, rows: [] };
    cur.kg += r.qtde_kg;
    cur.m2 += r.qtde_m2;
    cur.desp_kg += r.qtde_kg * ((r.fator_perda ?? 0) / 100);
    cur.desp_m2 += r.qtde_m2 * ((r.fator_perda ?? 0) / 100);
    cur.rows.push(r);
    matAgg.set(r.material, cur);
  });
  const matRows = Array.from(matAgg.entries())
    .filter(([m]) => m !== "outro")
    .sort((a, b) => b[1].desp_kg - a[1].desp_kg)
    .map(([m, v]) => {
      const media = meanOf(uniqueFatores(v.rows));
      return [
        MATERIAL_LABEL[m],
        fmtNum(v.kg),
        fmtNum(v.m2),
        fmtNum(v.desp_kg),
        fmtNum(v.desp_m2),
        media !== null ? fmtPct(media) : "—",
      ];
    });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Resumo por Material", margin, y);
  autoTable(doc, {
    startY: y + 8,
    head: [["Material", "Solicitado (kg)", "Solicitado (m²)", "Desperd. (kg)", "Desperd. (m²)", "Média %"]],
    body: matRows,
    theme: "striped",
    headStyles: { fillColor: [30, 64, 110], textColor: 255, fontSize: 10 },
    bodyStyles: { fontSize: 10 },
    margin: { left: margin, right: margin },
  });
  // @ts-expect-error
  y = doc.lastAutoTable.finalY + 20;

  // Top 10 itens — Média % = média simples dos fatores (uniqueFatores), igual ao dashboard
  const itemAgg = new Map<string, { qtde_kg: number; qtde_m2: number; desp_kg: number; desp_m2: number; descricao: string; rows: ReportRecord[] }>();
  records.forEach(r => {
    if (!r.codigo_item || r.fator_perda === null) return;
    const cur = itemAgg.get(r.codigo_item) ?? { qtde_kg: 0, qtde_m2: 0, desp_kg: 0, desp_m2: 0, descricao: r.descricao ?? "", rows: [] };
    cur.qtde_kg += r.qtde_kg;
    cur.qtde_m2 += r.qtde_m2;
    cur.desp_kg += r.qtde_kg * (r.fator_perda / 100);
    cur.desp_m2 += r.qtde_m2 * (r.fator_perda / 100);
    if (!cur.descricao && r.descricao) cur.descricao = r.descricao;
    cur.rows.push(r);
    itemAgg.set(r.codigo_item, cur);
  });
  const top10 = Array.from(itemAgg.entries())
    .map(([cod, v]) => ({ cod, ...v, media: meanOf(uniqueFatores(v.rows)) ?? 0 }))
    .sort((a, b) => b.desp_kg - a.desp_kg)
    .slice(0, 10);

  if (y > pageH - 120) { doc.addPage(); y = margin; }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Top 10 Itens — Maior Desperdício", margin, y);
  autoTable(doc, {
    startY: y + 8,
    head: [["Código", "Descrição", "Desperd. (kg)", "Desperd. (m²)", "Média %"]],
    body: top10.map(t => [
      t.cod,
      t.descricao.length > 70 ? t.descricao.slice(0, 70) + "…" : t.descricao,
      fmtNum(t.desp_kg),
      fmtNum(t.desp_m2),
      fmtPct(t.media),
    ]),
    theme: "striped",
    headStyles: { fillColor: [30, 64, 110], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 1: { cellWidth: 320 } },
    margin: { left: margin, right: margin },
  });

  // ============================================================
  // PÁGINA 2 — KPI Dashboard: Evolução mensal por material
  // ============================================================
  doc.addPage();

  // Header claro
  doc.setFillColor(245, 247, 250);
  doc.rect(0, 0, pageW, 70, "F");

  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Painel de Desperdício — Visão por Material", margin, 32);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(filtroResumo, margin, 50);

  // KPIs grandes no topo (4 cartões)
  const kpiY = 68;
  const kpiH = 78;
  const gap = 14;
  const kpiW = (pageW - margin * 2 - gap * 3) / 4;
  const kpis: Array<{ label: string; value: string; sub: string; color: [number, number, number] }> = [
    { label: "Solicitado", value: fmtNum(totals.solic_kg) + " kg", sub: fmtNum(totals.solic_m2) + " m²", color: [56, 189, 248] },
    { label: "Processado", value: fmtNum(totals.proc_kg) + " kg", sub: fmtNum(totals.proc_m2) + " m²", color: [74, 222, 128] },
    { label: "Desperdício", value: fmtNum(totals.desp_kg) + " kg", sub: fmtNum(totals.desp_m2) + " m²", color: [248, 113, 113] },
    { label: "Média de Perda", value: fmtPct(totals.mediaPerda), sub: fmtInt(totals.fpps) + " FPPs", color: [251, 191, 36] },
  ];
  kpis.forEach((k, i) => {
    const x = margin + i * (kpiW + gap);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, kpiY, kpiW, kpiH, 8, 8, "F");
    doc.setDrawColor(220, 225, 230);
    doc.roundedRect(x, kpiY, kpiW, kpiH, 8, 8, "S");
    // accent bar
    doc.setFillColor(...k.color);
    doc.roundedRect(x, kpiY, 4, kpiH, 2, 2, "F");
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(k.label.toUpperCase(), x + 14, kpiY + 18);
    doc.setTextColor(30, 30, 30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(k.value, x + 14, kpiY + 44);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(k.sub, x + 14, kpiY + 62);
  });

  // Matriz mensal por ano (estilo dashboard) — média simples (uniqueFatores) por mês/ano
  const yearMonthly = new Map<number, Record<MaterialKind, ReportRecord[][]>>();
  const yearAll = new Map<number, Record<MaterialKind, ReportRecord[]>>();
  records.forEach(r => {
    if (!r.data_registro || r.material === "outro") return;
    const d = new Date(r.data_registro);
    const yr = d.getFullYear();
    if (!yearMonthly.has(yr)) {
      yearMonthly.set(yr, {
        inox: Array.from({ length: 12 }, () => []),
        galvanizado: Array.from({ length: 12 }, () => []),
        aluminio: Array.from({ length: 12 }, () => []),
        outro: Array.from({ length: 12 }, () => []),
      });
      yearAll.set(yr, { inox: [], galvanizado: [], aluminio: [], outro: [] });
    }
    yearMonthly.get(yr)![r.material][d.getMonth()].push(r);
    yearAll.get(yr)![r.material].push(r);
  });

  const years = Array.from(yearMonthly.keys()).sort((a, b) => b - a);
  let cardY = kpiY + kpiH + 24;
  const mats: MaterialKind[] = ["galvanizado", "inox", "aluminio"];

  years.forEach(yr => {
    if (cardY > pageH - 140) {
      doc.addPage();
      cardY = margin;
    }

    // Card title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 30, 30);
    doc.text(`Média de Desperdício Mensal — ${yr}`, margin, cardY);
    cardY += 6;

    // Build matrix rows with white background and green/red text based on targets
    const colW = (pageW - margin * 2 - 100 - 60) / 12; // 100=label, 60=acum
    const rowH = 26;
    const tableTop = cardY + 8;

    // Header row (months)
    doc.setFillColor(230, 235, 240);
    doc.rect(margin, tableTop, pageW - margin * 2, rowH, "F");
    doc.setTextColor(60, 60, 60);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("MATERIAL", margin + 8, tableTop + rowH / 2 + 3);
    MONTHS.forEach((mo, i) => {
      doc.text(mo, margin + 100 + i * colW + colW / 2, tableTop + rowH / 2 + 3, { align: "center" });
    });
    doc.text("ACUM.", margin + 100 + 12 * colW + 30, tableTop + rowH / 2 + 3, { align: "center" });

    mats.forEach((mat, mi) => {
      const ry = tableTop + rowH + mi * rowH;
      doc.setFillColor(mi % 2 === 0 ? 255 : 250, mi % 2 === 0 ? 255 : 250, mi % 2 === 0 ? 255 : 250);
      doc.rect(margin, ry, pageW - margin * 2, rowH, "F");
      doc.setDrawColor(220, 225, 230);
      doc.rect(margin, ry, pageW - margin * 2, rowH, "S");

      // material label with accent
      const [r, g, b] = MAT_COLOR[mat];
      doc.setFillColor(r, g, b);
      doc.circle(margin + 12, ry + rowH / 2, 4, "F");
      doc.setTextColor(30, 30, 30);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(MATERIAL_LABEL[mat], margin + 22, ry + rowH / 2 + 3);

      const cells = yearMonthly.get(yr)![mat];
      const meta = META[mat as Exclude<MaterialKind, "outro">];
      cells.forEach((rows, i) => {
        const pct = rows.length ? meanOf(uniqueFatores(rows)) : null;
        const cx = margin + 100 + i * colW;
        if (pct !== null) {
          // No background — just text color based on target
          const hit = pct <= meta;
          doc.setTextColor(hit ? 34 : 220, hit ? 197 : 38, hit ? 94 : 38);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.text(fmtPct(pct), cx + colW / 2, ry + rowH / 2 + 3, { align: "center" });
        } else {
          doc.setTextColor(150, 160, 170);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.text("—", cx + colW / 2, ry + rowH / 2 + 3, { align: "center" });
        }
      });
      // Acum. — uniqueFatores sobre TODOS os registros do ano do material (mesma fonte)
      const ax = margin + 100 + 12 * colW;
      const acumPct = meanOf(uniqueFatores(yearAll.get(yr)![mat]));
      const acumHit = acumPct !== null && acumPct <= meta;
      doc.setTextColor(acumHit ? 34 : 220, acumHit ? 197 : 38, acumHit ? 94 : 38);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(acumPct !== null ? fmtPct(acumPct) : "—", ax + 30, ry + rowH / 2 + 3, { align: "center" });
    });

    cardY = tableTop + rowH * (mats.length + 1) + 24;
  });

  // Footer com paginação
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Página ${i} de ${total}`, pageW - margin, pageH - 16, { align: "right" });
  }

  doc.save(`relatorio_desperdicio_${new Date().toISOString().slice(0, 10)}.pdf`);
}
