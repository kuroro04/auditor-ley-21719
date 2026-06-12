'use client';

import { REQUISITOS } from './requisitos';
import { TEMPLATES } from './templateContent';
import type { RequisitoResult, UploadedDoc } from './types';

// ── Paleta de colores (RGB) ──
const C = {
  navy:       [15,  30,  61]  as [number,number,number],
  navy2:      [26,  47,  90]  as [number,number,number],
  blue:       [37,  99, 235]  as [number,number,number],
  green:      [22, 163,  74]  as [number,number,number],
  yellow:     [217,119,   6]  as [number,number,number],
  red:        [220,  38,  38]  as [number,number,number],
  gray:       [138,150,184]  as [number,number,number],
  lightGray:  [226,230,240]  as [number,number,number],
  bgGray:     [247,248,252]  as [number,number,number],
  white:      [255,255,255]  as [number,number,number],
  text:       [15,  30,  61]  as [number,number,number],
  text2:      [74,  88, 128]  as [number,number,number],
};

// ── Helpers de color para estados ──
function estadoColor(estado: string): [number,number,number] {
  if (estado === 'green')        return C.green;
  if (estado === 'yellow')       return C.yellow;
  if (estado === 'unanalyzable') return C.gray;
  return C.red;
}
function estadoLabel(estado: string): string {
  if (estado === 'green')        return 'Cumple';
  if (estado === 'yellow')       return 'Parcial';
  if (estado === 'unanalyzable') return 'Sin datos';
  return 'Faltante';
}

// ────────────────────────────────────────────────────────────
// 1. INFORME COMPLETO DE CUMPLIMIENTO
// ────────────────────────────────────────────────────────────
export async function generarInformePDF(
  companyName: string,
  results: Record<string, RequisitoResult>,
  uploadedDocs: Record<string, UploadedDoc>,
): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const margin = 20;
  let y = 0;

  // ── Calcular métricas ──
  const unanalyzable = REQUISITOS.filter(r => results[r.id]?.estado === 'unanalyzable').length;
  const analyzable   = REQUISITOS.length - unanalyzable;
  const green  = REQUISITOS.filter(r => results[r.id]?.estado === 'green').length;
  const yellow = REQUISITOS.filter(r => results[r.id]?.estado === 'yellow').length;
  const red    = REQUISITOS.filter(r => results[r.id]?.estado === 'red').length;
  const pct    = analyzable > 0 ? Math.round((green * 100 + yellow * 50) / (analyzable * 100) * 100) : 0;
  const totalWords = Object.values(uploadedDocs).reduce((acc, d) => acc + (d.wordCount ?? 0), 0);

  const totalExposure = REQUISITOS.reduce((acc, r) => {
    const estado = results[r.id]?.estado;
    if (estado === 'red' || estado === 'yellow') {
      return acc + parseInt(r.multa.replace(/\D/g, ''), 10);
    }
    return acc;
  }, 0);

  const fecha = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });

  // ══════════════════════════════════════
  // PÁGINA 1 — Portada + resumen ejecutivo
  // ══════════════════════════════════════

  // Header navy
  doc.setFillColor(...C.navy);
  doc.rect(0, 0, PW, 52, 'F');

  // Logo / nombre producto
  doc.setTextColor(...C.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('DataShield', margin, 20);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Informe de Cumplimiento — Ley 21.719 de Protección de Datos Personales', margin, 29);

  // Fecha en header
  doc.setFontSize(9);
  doc.setTextColor(...C.gray);
  doc.text(`Generado: ${fecha}`, PW - margin, 20, { align: 'right' });

  // Datos empresa en header
  doc.setFontSize(10);
  doc.setTextColor(200, 210, 240);
  doc.text(`Empresa / RUT: ${companyName}`, margin, 43);
  doc.text(`${Object.keys(uploadedDocs).length} documentos analizados · ${totalWords.toLocaleString('es-CL')} palabras procesadas`, PW - margin, 43, { align: 'right' });

  y = 68;

  // ── Score grande ──
  const scoreColor = pct >= 75 ? C.green : pct >= 40 ? C.yellow : C.red;
  doc.setFontSize(56);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...scoreColor);
  doc.text(`${pct}%`, margin, y + 16);

  doc.setFontSize(13);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...C.text2);
  doc.text('cumplimiento confirmado', margin, y + 26);
  if (unanalyzable > 0) {
    doc.setFontSize(10);
    doc.setTextColor(...C.gray);
    doc.text(`(${analyzable} de ${REQUISITOS.length} requisitos analizables · ${unanalyzable} sin datos)`, margin, y + 34);
  }

  // ── Semáforo ──
  const semX = PW - 80;
  const semData = [
    { label: 'Cumple',    count: green,        color: C.green  },
    { label: 'Parcial',   count: yellow,       color: C.yellow },
    { label: 'Faltante',  count: red,          color: C.red    },
    { label: 'Sin datos', count: unanalyzable, color: C.gray   },
  ];
  semData.forEach((s, i) => {
    const sy = y + i * 12;
    doc.setFillColor(...s.color);
    doc.roundedRect(semX, sy, 8, 8, 1, 1, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.text);
    doc.text(String(s.count), semX + 12, sy + 6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.text2);
    doc.text(s.label, semX + 22, sy + 6.5);
  });

  y += 54;

  // ── Barra de cumplimiento ──
  doc.setDrawColor(...C.lightGray);
  doc.setFillColor(...C.bgGray);
  doc.roundedRect(margin, y, PW - margin * 2, 8, 2, 2, 'FD');
  doc.setFillColor(...scoreColor);
  doc.roundedRect(margin, y, (PW - margin * 2) * (pct / 100), 8, 2, 2, 'F');
  y += 18;

  // ── Título de tabla ──
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.text);
  doc.text('Estado por requisito legal', margin, y);
  y += 6;

  // ── Tabla de requisitos ──
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['#', 'Requisito', 'Estado', 'Cobertura', 'Multa máx.']],
    body: REQUISITOS.map(r => {
      const res = results[r.id];
      return [
        r.num,
        r.nombre,
        estadoLabel(res?.estado ?? 'red'),
        `${res?.cobertura ?? 0}%`,
        r.multa,
      ];
    }),
    styles: { fontSize: 8.5, cellPadding: 3.5, font: 'helvetica' },
    headStyles: {
      fillColor: C.navy,
      textColor: C.white,
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 82 },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 24, halign: 'right' },
    },
    alternateRowStyles: { fillColor: C.bgGray },
    didParseCell: (data) => {
      if (data.column.index === 2 && data.section === 'body') {
        const v = data.cell.text[0];
        data.cell.styles.fontStyle = 'bold';
        if (v === 'Cumple')   data.cell.styles.textColor = C.green;
        if (v === 'Parcial')  data.cell.styles.textColor = C.yellow;
        if (v === 'Faltante') data.cell.styles.textColor = C.red;
        if (v === 'Sin datos') data.cell.styles.textColor = C.gray;
      }
    },
  });

  // @ts-ignore — autoTable agrega lastAutoTable al objeto jsPDF
  y = (doc as any).lastAutoTable.finalY + 12;

  // ══════════════════════════════════════
  // SECCIÓN — Brechas detectadas
  // ══════════════════════════════════════
  const brechas = REQUISITOS.filter(r => {
    const e = results[r.id]?.estado;
    return e === 'red' || e === 'yellow';
  });

  if (brechas.length > 0) {
    if (y > PH - 60) { doc.addPage(); y = 20; }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.text);
    doc.text('Brechas detectadas y recomendaciones', margin, y);
    y += 7;

    for (const r of brechas) {
      const res = results[r.id];
      if (!res) continue;

      if (y > PH - 40) { doc.addPage(); y = 20; }

      // Card de brecha
      const bgColor = res.estado === 'yellow' ? [255, 251, 235] as [number,number,number] : [254, 242, 242] as [number,number,number];
      const borderColor = res.estado === 'yellow' ? C.yellow : C.red;
      doc.setFillColor(...bgColor);
      doc.setDrawColor(...borderColor);
      doc.roundedRect(margin, y, PW - margin * 2, 22, 2, 2, 'FD');

      // Nombre requisito
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.text);
      doc.text(`${r.num}. ${r.nombre}`, margin + 4, y + 7);

      // Estado + cobertura
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...borderColor);
      doc.text(`${estadoLabel(res.estado)} · ${res.cobertura}% cobertura · Multa: ${r.multa}`, margin + 4, y + 13);

      // Gap text
      doc.setTextColor(...C.text2);
      const gapLines = doc.splitTextToSize(res.gap, PW - margin * 2 - 8);
      doc.text(gapLines[0] || '', margin + 4, y + 19);

      y += 27;
    }
  }

  // ══════════════════════════════════════
  // SECCIÓN — Exposición a multas
  // ══════════════════════════════════════
  if (y > PH - 50) { doc.addPage(); y = 20; }

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.text);
  doc.text('Exposición total a multas APDP', margin, y);
  y += 8;

  doc.setFillColor(...C.bgGray);
  doc.setDrawColor(...C.lightGray);
  doc.roundedRect(margin, y, PW - margin * 2, 16, 2, 2, 'FD');
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.red);
  doc.text(`${totalExposure.toLocaleString('es-CL')} UTM`, margin + 6, y + 11);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...C.text2);
  doc.text('exposición acumulada en multas máximas si no se corrigen las brechas', margin + 70, y + 11);
  y += 24;

  // ══════════════════════════════════════
  // PIE DE PÁGINA (todas las páginas)
  // ══════════════════════════════════════
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(...C.bgGray);
    doc.rect(0, PH - 14, PW, 14, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.gray);
    doc.text(
      'AVISO LEGAL: Este informe es generado automáticamente por DataShield con fines orientativos. No constituye asesoría legal. Para cumplimiento definitivo consulte a un abogado especializado en protección de datos.',
      margin,
      PH - 7,
    );
    doc.text(`Pág. ${i} / ${totalPages}`, PW - margin, PH - 7, { align: 'right' });
  }

  const rut = companyName.replace(/[^a-z0-9]/gi, '_') || 'empresa';
  const fechaArchivo = new Date().toISOString().slice(0, 10);
  doc.save(`Diagnostico_DataShield_${rut}_${fechaArchivo}.pdf`);
}

// ────────────────────────────────────────────────────────────
// 2. PLANTILLA PDF DE DOCUMENTO LEGAL
// ────────────────────────────────────────────────────────────
export async function generarPlantillaPDF(reqId: string, companyName: string): Promise<void> {
  const tpl = TEMPLATES[reqId];
  if (!tpl) throw new Error(`No existe plantilla para ${reqId}`);

  const { default: jsPDF } = await import('jspdf');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const margin = 22;
  let y = 0;

  const fecha = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });

  const addPage = () => {
    doc.addPage();
    y = margin;
    // Header pequeño en páginas siguientes
    doc.setFillColor(...C.navy);
    doc.rect(0, 0, PW, 10, 'F');
    doc.setFontSize(7);
    doc.setTextColor(...C.white);
    doc.text(`DataShield · ${tpl.titulo}`, margin, 7);
    y = 18;
  };

  const checkY = (needed: number) => {
    if (y + needed > PH - 20) addPage();
  };

  // ── Portada ──
  doc.setFillColor(...C.navy);
  doc.rect(0, 0, PW, 45, 'F');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 200, 255);
  doc.text('DataShield · Ley 21.719 de Protección de Datos Personales', margin, 13);
  doc.text(tpl.articulo, margin, 20);

  doc.setFontSize(8);
  doc.setTextColor(...C.gray);
  doc.text(`Empresa: ${companyName || '[NOMBRE EMPRESA]'}  ·  Fecha: ${fecha}`, margin, 30);
  doc.text('DOCUMENTO PLANTILLA — Completar los campos indicados', margin, 37);

  y = 57;

  // Título
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.text);
  const titleLines = doc.splitTextToSize(tpl.titulo, PW - margin * 2);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 8 + 4;

  // Línea separadora
  doc.setDrawColor(...C.lightGray);
  doc.line(margin, y, PW - margin, y);
  y += 8;

  // Propósito
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.blue);
  doc.text('Propósito de este documento:', margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...C.text2);
  const propLines = doc.splitTextToSize(tpl.proposito, PW - margin * 2);
  doc.text(propLines, margin, y);
  y += propLines.length * 5 + 10;

  // Instrucción de uso
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(147, 197, 253);
  doc.roundedRect(margin, y, PW - margin * 2, 12, 2, 2, 'FD');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.blue);
  doc.text('📋 Instrucción: Complete todos los campos marcados con [COMPLETAR] antes de usar este documento.', margin + 4, y + 8);
  y += 18;

  // ── Secciones ──
  for (const seccion of tpl.secciones) {
    checkY(30);

    // Título de sección
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.navy);
    doc.text(seccion.titulo, margin, y);
    y += 6;

    // Instrucción
    if (seccion.instruccion) {
      checkY(12);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(...C.gray);
      const instrLines = doc.splitTextToSize(`📌 ${seccion.instruccion}`, PW - margin * 2);
      doc.text(instrLines, margin, y);
      y += instrLines.length * 4.5 + 3;
    }

    // Contenido placeholder
    const lineas = seccion.placeholder.split('\n');
    for (const linea of lineas) {
      checkY(6);
      const isPlaceholder = linea.includes('[COMPLETAR');

      if (isPlaceholder) {
        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...C.blue);
      } else if (linea === '') {
        y += 2;
        continue;
      } else {
        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...C.text);
      }

      const wrappedLines = doc.splitTextToSize(linea, PW - margin * 2);
      doc.text(wrappedLines, margin, y);
      y += wrappedLines.length * 5 + 1;
    }

    // Separador entre secciones
    checkY(8);
    doc.setDrawColor(...C.lightGray);
    doc.line(margin, y + 3, PW - margin, y + 3);
    y += 10;
  }

  // ── Notas legales ──
  checkY(35);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.text);
  doc.text('Notas legales:', margin, y);
  y += 6;
  for (const nota of tpl.notas) {
    checkY(8);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.text2);
    const notaLines = doc.splitTextToSize(`• ${nota}`, PW - margin * 2);
    doc.text(notaLines, margin, y);
    y += notaLines.length * 4.5 + 2;
  }

  // ── Pie de página en todas las páginas ──
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(...C.bgGray);
    doc.rect(0, PH - 12, PW, 12, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.gray);
    doc.text(
      'Plantilla generada por DataShield · No constituye asesoría legal · Consulte a un abogado especializado en protección de datos.',
      margin, PH - 5,
    );
    doc.text(`Pág. ${i} / ${totalPages}`, PW - margin, PH - 5, { align: 'right' });
  }

  doc.save(`plantilla_${reqId}_${companyName.replace(/[^a-z0-9]/gi, '_') || 'empresa'}.pdf`);
}
