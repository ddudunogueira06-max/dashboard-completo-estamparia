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
      ["Média Ponderada de Perda", fmtPct(totals.mediaPerda), "—"],
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

  // Resumo por material
  const matAgg = new Map<MaterialKind, { kg: number; m2: number; desp_kg: number; desp_m2: number }>();
  records.forEach(r => {
    const cur = matAgg.get(r.material) ?? { kg: 0, m2: 0, desp_kg: 0, desp_m2: 0 };
    cur.kg += r.qtde_kg;
    cur.m2 += r.qtde_m2;
    cur.desp_kg += r.qtde_kg * ((r.fator_perda ?? 0) / 100);
    cur.desp_m2 += r.qtde_m2 * ((r.fator_perda ?? 0) / 100);
    matAgg.set(r.material, cur);
  });
  const matRows = Array.from(matAgg.entries())
    .filter(([m]) => m !== "outro")
    .sort((a, b) => b[1].desp_kg - a[1].desp_kg)
    .map(([m, v]) => [
      MATERIAL_LABEL[m],
      fmtNum(v.kg),
      fmtNum(v.m2),
      fmtNum(v.desp_kg),
      fmtNum(v.desp_m2),
      v.kg > 0 ? fmtPct((v.desp_kg / v.kg) * 100) : "—",
    ]);

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

  // Top 10 itens
  const itemAgg = new Map<string, { qtde_kg: number; qtde_m2: number; desp_kg: number; desp_m2: number; descricao: string }>();
  records.forEach(r => {
    if (!r.codigo_item || r.fator_perda === null) return;
    const cur = itemAgg.get(r.codigo_item) ?? { qtde_kg: 0, qtde_m2: 0, desp_kg: 0, desp_m2: 0, descricao: r.descricao ?? "" };
    cur.qtde_kg += r.qtde_kg;
    cur.qtde_m2 += r.qtde_m2;
    cur.desp_kg += r.qtde_kg * (r.fator_perda / 100);
    cur.desp_m2 += r.qtde_m2 * (r.fator_perda / 100);
    if (!cur.descricao && r.descricao) cur.descricao = r.descricao;
    itemAgg.set(r.codigo_item, cur);
  });
  const top10 = Array.from(itemAgg.entries())
    .map(([cod, v]) => ({ cod, ...v, media: v.qtde_kg > 0 ? (v.desp_kg / v.qtde_kg) * 100 : 0 }))
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

  // Matriz mensal por ano (estilo dashboard)
  const yearMonthly = new Map<number, Record<MaterialKind, Array<{ qtde_kg: number; desp_kg: number }>>>();
  records.forEach(r => {
    if (!r.data_registro || r.material === "outro") return;
    const d = new Date(r.data_registro);
    const yr = d.getFullYear();
    if (!yearMonthly.has(yr)) {
      yearMonthly.set(yr, {
        inox: Array.from({ length: 12 }, () => ({ qtde_kg: 0, desp_kg: 0 })),
        galvanizado: Array.from({ length: 12 }, () => ({ qtde_kg: 0, desp_kg: 0 })),
        aluminio: Array.from({ length: 12 }, () => ({ qtde_kg: 0, desp_kg: 0 })),
        outro: Array.from({ length: 12 }, () => ({ qtde_kg: 0, desp_kg: 0 })),
      });
    }
    const m = yearMonthly.get(yr)![r.material];
    m[d.getMonth()].qtde_kg += r.qtde_kg;
    m[d.getMonth()].desp_kg += r.qtde_kg * ((r.fator_perda ?? 0) / 100);
  });

  const years = Array.from(yearMonthly.keys()).sort((a, b) => b - a);
  let cardY = kpiY + kpiH + 24;
  const mats: MaterialKind[] = ["galvanizado", "inox", "aluminio"];

  years.forEach(yr => {
    if (cardY > pageH - 140) {
      doc.addPage();
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageW, pageH, "F");
      cardY = margin;
    }

    // Card title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text(`Média de Desperdício Mensal — ${yr}`, margin, cardY);
    cardY += 6;

    // Build matrix rows with mini sparkline-like cells colored by intensity
    const colW = (pageW - margin * 2 - 100 - 60) / 12; // 100=label, 60=acum
    const rowH = 26;
    const tableTop = cardY + 8;

    // Header row (months)
    doc.setFillColor(30, 41, 59);
    doc.rect(margin, tableTop, pageW - margin * 2, rowH, "F");
    doc.setTextColor(148, 163, 184);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("MATERIAL", margin + 8, tableTop + rowH / 2 + 3);
    MONTHS.forEach((mo, i) => {
      doc.text(mo, margin + 100 + i * colW + colW / 2, tableTop + rowH / 2 + 3, { align: "center" });
    });
    doc.text("ACUM.", margin + 100 + 12 * colW + 30, tableTop + rowH / 2 + 3, { align: "center" });

    mats.forEach((mat, mi) => {
      const ry = tableTop + rowH + mi * rowH;
      doc.setFillColor(mi % 2 === 0 ? 22 : 26, mi % 2 === 0 ? 32 : 36, mi % 2 === 0 ? 48 : 54);
      doc.rect(margin, ry, pageW - margin * 2, rowH, "F");

      // material label with accent
      const [r, g, b] = MAT_COLOR[mat];
      doc.setFillColor(r, g, b);
      doc.circle(margin + 12, ry + rowH / 2, 4, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(MATERIAL_LABEL[mat], margin + 22, ry + rowH / 2 + 3);

      const cells = yearMonthly.get(yr)![mat];
      let tq = 0, td = 0;
      cells.forEach((c, i) => {
        tq += c.qtde_kg; td += c.desp_kg;
        const pct = c.qtde_kg > 0 ? (c.desp_kg / c.qtde_kg) * 100 : null;
        const cx = margin + 100 + i * colW;
        if (pct !== null) {
          // intensity background
          const intensity = Math.min(1, pct / 30); // 30% as max
          doc.setFillColor(r, g, b);
          doc.setGState(doc.GState({ opacity: 0.12 + intensity * 0.55 }));
          doc.roundedRect(cx + 2, ry + 4, colW - 4, rowH - 8, 3, 3, "F");
          doc.setGState(doc.GState({ opacity: 1 }));
          doc.setTextColor(255, 255, 255);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.text(fmtPct(pct), cx + colW / 2, ry + rowH / 2 + 3, { align: "center" });
        } else {
          doc.setTextColor(100, 116, 139);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.text("—", cx + colW / 2, ry + rowH / 2 + 3, { align: "center" });
        }
      });
      // Acum.
      const ax = margin + 100 + 12 * colW;
      doc.setFillColor(r, g, b);
      doc.setGState(doc.GState({ opacity: 0.25 }));
      doc.roundedRect(ax + 2, ry + 4, 60 - 4, rowH - 8, 3, 3, "F");
      doc.setGState(doc.GState({ opacity: 1 }));
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(tq > 0 ? fmtPct((td / tq) * 100) : "—", ax + 30, ry + rowH / 2 + 3, { align: "center" });
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
