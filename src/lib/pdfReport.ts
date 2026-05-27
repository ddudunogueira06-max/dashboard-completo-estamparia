import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fmtNum, fmtInt, fmtPct, fmtDate } from "@/lib/format";
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
  qtde_m2: number; // qtde_solicitada (m²)
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

export function generateWasteReportPDF(records: ReportRecord[], totals: Totals, filtroResumo: string) {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 36;
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

  // Resumo executivo
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Resumo Executivo", margin, y);
  y += 8;

  autoTable(doc, {
    startY: y + 4,
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
  // @ts-expect-error - lastAutoTable injected
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

  // Top 10 itens por desperdício
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

  if (y > 700) { doc.addPage(); y = margin; }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Top 10 Itens — Maior Desperdício", margin, y);
  autoTable(doc, {
    startY: y + 8,
    head: [["Código", "Descrição", "Desperd. (kg)", "Desperd. (m²)", "Média %"]],
    body: top10.map(t => [
      t.cod,
      t.descricao.length > 50 ? t.descricao.slice(0, 50) + "…" : t.descricao,
      fmtNum(t.desp_kg),
      fmtNum(t.desp_m2),
      fmtPct(t.media),
    ]),
    theme: "striped",
    headStyles: { fillColor: [30, 64, 110], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 1: { cellWidth: 200 } },
    margin: { left: margin, right: margin },
  });
  // @ts-expect-error
  y = doc.lastAutoTable.finalY + 20;

  // Evolução mensal por material (ano corrente nos dados)
  const yearAgg = new Map<number, Map<MaterialKind, { qtde_kg: number; desp_kg: number }>>();
  records.forEach(r => {
    if (!r.data_registro || r.material === "outro") return;
    const d = new Date(r.data_registro);
    const yr = d.getFullYear();
    const mo = d.getMonth();
    if (!yearAgg.has(yr)) yearAgg.set(yr, new Map());
    const yMap = yearAgg.get(yr)!;
    const key = r.material;
    const cur = yMap.get(key) ?? { qtde_kg: 0, desp_kg: 0 };
    cur.qtde_kg += r.qtde_kg;
    cur.desp_kg += r.qtde_kg * ((r.fator_perda ?? 0) / 100);
    yMap.set(key, cur);
    // monthly stored separately below
    void mo;
  });

  // Build per-year monthly matrix
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
  years.forEach(yr => {
    if (y > 650) { doc.addPage(); y = margin; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`Média de Desperdício Mensal — ${yr}`, margin, y);
    const mats: MaterialKind[] = ["inox", "galvanizado", "aluminio"];
    const body = mats.map(mat => {
      const cells = yearMonthly.get(yr)![mat];
      const row: string[] = [MATERIAL_LABEL[mat]];
      let tq = 0, td = 0;
      cells.forEach(c => {
        tq += c.qtde_kg; td += c.desp_kg;
        row.push(c.qtde_kg > 0 ? fmtPct((c.desp_kg / c.qtde_kg) * 100) : "—");
      });
      row.push(tq > 0 ? fmtPct((td / tq) * 100) : "—");
      return row;
    });
    autoTable(doc, {
      startY: y + 8,
      head: [["Material", ...MONTHS, "Acum."]],
      body,
      theme: "grid",
      headStyles: { fillColor: [30, 64, 110], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8, halign: "center" },
      columnStyles: { 0: { halign: "left", fontStyle: "bold" } },
      margin: { left: margin, right: margin },
    });
    // @ts-expect-error
    y = doc.lastAutoTable.finalY + 16;
  });

  // Detalhamento completo
  doc.addPage();
  y = margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`Detalhamento Completo (${fmtInt(records.length)} registros)`, margin, y);
  autoTable(doc, {
    startY: y + 8,
    head: [["Data", "Tipo", "Nº", "Código", "Descrição", "Material", "Fator %", "Qtde (kg)", "Qtde (m²)", "Retalho (kg)"]],
    body: records.map(r => [
      r.data_registro ? fmtDate(r.data_registro) : "—",
      r.tipo ?? "—",
      r.numero ?? "—",
      r.codigo_item ?? "—",
      (r.descricao ?? "").length > 38 ? (r.descricao ?? "").slice(0, 38) + "…" : (r.descricao ?? ""),
      r.detLabel || MATERIAL_LABEL[r.material],
      r.fator_perda !== null ? fmtPct(r.fator_perda) : "—",
      fmtNum(r.qtde_kg),
      fmtNum(r.qtde_m2),
      fmtNum(r.retalho_kg),
    ]),
    theme: "striped",
    headStyles: { fillColor: [30, 64, 110], textColor: 255, fontSize: 7 },
    bodyStyles: { fontSize: 7 },
    columnStyles: { 4: { cellWidth: 130 } },
    margin: { left: margin, right: margin },
  });

  // Footer com paginação
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Página ${i} de ${total}`, pageW - margin, doc.internal.pageSize.getHeight() - 16, { align: "right" });
  }

  doc.save(`relatorio_desperdicio_${new Date().toISOString().slice(0, 10)}.pdf`);
}
