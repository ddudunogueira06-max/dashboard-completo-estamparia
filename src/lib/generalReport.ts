import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface ReportSection {
  /** Módulo de origem — vira uma aba/página do relatório */
  module: string;
  title: string;
  /** Linha de KPIs exibida acima da tabela */
  kpis: { label: string; value: string }[];
  columns: string[];
  rows: (string | number)[][];
  /** Cor de destaque do módulo em RGB */
  color: [number, number, number];
}

const brand: [number, number, number] = [8, 32, 59];

/** Relatório geral em PDF: uma página (aba) por módulo, com KPIs e tabela. */
export function generateGeneralReportPDF(sections: ReportSection[], periodo: string) {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 36;
  const gerado = new Date().toLocaleString("pt-BR");

  // Capa
  doc.setFillColor(...brand);
  doc.rect(0, 0, pageW, pageH, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  doc.text("Relatório Geral de Produção", margin, 160);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.text(`Período: ${periodo}`, margin, 190);
  doc.text(`Gerado em ${gerado}`, margin, 210);
  doc.setFontSize(11);
  doc.text("Abas incluídas:", margin, 260);
  sections.forEach((s, i) => doc.text(`•  ${s.module} — ${s.title}`, margin + 14, 282 + i * 18));

  sections.forEach((s) => {
    doc.addPage();
    doc.setFillColor(...s.color);
    doc.rect(0, 0, pageW, 56, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(s.module.toUpperCase(), margin, 26);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(s.title, margin, 44);

    let y = 80;
    if (s.kpis.length) {
      const w = (pageW - margin * 2 - (s.kpis.length - 1) * 10) / s.kpis.length;
      s.kpis.forEach((k, i) => {
        const x = margin + i * (w + 10);
        doc.setDrawColor(220, 224, 230);
        doc.setFillColor(246, 248, 250);
        doc.roundedRect(x, y, w, 52, 6, 6, "FD");
        doc.setTextColor(110, 118, 128);
        doc.setFontSize(8);
        doc.text(k.label.toUpperCase(), x + 10, y + 18);
        doc.setTextColor(...s.color);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(15);
        doc.text(k.value, x + 10, y + 40);
        doc.setFont("helvetica", "normal");
      });
      y += 70;
    }

    autoTable(doc, {
      startY: y,
      head: [s.columns],
      body: s.rows.length ? s.rows : [s.columns.map(() => "—")],
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 4, textColor: [35, 40, 48] },
      headStyles: { fillColor: s.color, textColor: [255, 255, 255], fontSize: 8 },
      alternateRowStyles: { fillColor: [247, 249, 251] },
    });
  });

  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    if (p === 1) continue;
    doc.setFontSize(8);
    doc.setTextColor(140, 146, 155);
    doc.text(`Controle Industrial · ${gerado}`, margin, pageH - 16);
    doc.text(`${p}/${total}`, pageW - margin, pageH - 16, { align: "right" });
  }

  doc.save(`relatorio-geral-${new Date().toISOString().slice(0, 10)}.pdf`);
}
