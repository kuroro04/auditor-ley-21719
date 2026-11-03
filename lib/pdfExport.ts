'use client';

import { REQUISITOS } from './requisitos';
import { TEMPLATES } from './templateContent';
import { calcPct } from './metrics';
import type { RequisitoResult, UploadedDoc, Sector } from './types';
import { SECTOR_DATA } from './sectorData';

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

// ── Helper de etiqueta para estados ──
function estadoLabel(estado: string): string {
  if (estado === 'green')        return 'Cumple';
  if (estado === 'yellow')       return 'Parcial';
  if (estado === 'unanalyzable') return 'Sin datos';
  if (estado === 'wrong_type')   return 'Tipo incorrecto';
  if (estado === 'pending')      return 'Pendiente';
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

  // ── Calcular métricas (fuente única: lib/metrics.ts) ──
  const { pct, green, yellow, red, unanalyzable, wrong_type, pending, analyzable } = calcPct(results);
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
  const noAnalizables = unanalyzable + wrong_type + pending;
  if (noAnalizables > 0) {
    const partes: string[] = [];
    if (unanalyzable > 0) partes.push(`${unanalyzable} sin datos`);
    if (wrong_type   > 0) partes.push(`${wrong_type} tipo incorrecto`);
    if (pending      > 0) partes.push(`${pending} pendientes`);
    doc.setFontSize(10);
    doc.setTextColor(...C.gray);
    doc.text(`(${analyzable} de ${REQUISITOS.length} analizables · ${partes.join(' · ')})`, margin, y + 34);
  }

  // ── Semáforo ──
  const semX = PW - 80;
  const semData = [
    { label: 'Cumple',          count: green,        color: C.green  },
    { label: 'Parcial',         count: yellow,       color: C.yellow },
    { label: 'Faltante',        count: red,          color: C.red    },
    { label: 'Sin datos',       count: unanalyzable, color: C.gray   },
    ...(wrong_type > 0 ? [{ label: 'Tipo incorrecto', count: wrong_type, color: C.gray }] : []),
    ...(pending    > 0 ? [{ label: 'Pendiente',       count: pending,    color: C.gray }] : []),
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

  y += Math.max(54, semData.length * 12 + 6);

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
        if (v === 'Cumple')          data.cell.styles.textColor = C.green;
        if (v === 'Parcial')         data.cell.styles.textColor = C.yellow;
        if (v === 'Faltante')        data.cell.styles.textColor = C.red;
        if (v === 'Sin datos')       data.cell.styles.textColor = C.gray;
        if (v === 'Tipo incorrecto') data.cell.styles.textColor = C.gray;
        if (v === 'Pendiente')       data.cell.styles.textColor = C.gray;
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
// 2. PLANTILLA PDF DE DOCUMENTO LEGAL (Diseño Ejecutivo y Profesional)
// ────────────────────────────────────────────────────────────
export async function generarPlantillaPDF(reqId: string, companyName: string): Promise<void> {
  const tpl = TEMPLATES[reqId];
  if (!tpl) throw new Error(`No existe plantilla para ${reqId}`);

  const { default: jsPDF } = await import('jspdf');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const margin = 20;
  let y = 0;

  const fecha = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });

  const addPage = () => {
    doc.addPage();
    y = margin;
    // Header minimalista y elegante en páginas 2+
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, PW, 2.5, 'F');
    doc.setFillColor(37, 99, 235); // blue-600
    doc.rect(0, 2.5, PW, 0.8, 'F');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text(`DataShield · ${tpl.titulo}`, margin, 9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text('Ley N° 21.719 (Chile)', PW - margin, 9, { align: 'right' });

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, 12, PW - margin, 12);

    y = 18;
  };

  const checkY = (needed: number) => {
    if (y + needed > PH - 22) addPage();
  };

  // ── Portada / Encabezado Ejecutivo (Página 1) ──
  // Doble barra superior de prestigio corporativo
  doc.setFillColor(15, 23, 42); // deep navy
  doc.rect(0, 0, PW, 3.5, 'F');
  doc.setFillColor(37, 99, 235); // electric sapphire
  doc.rect(0, 3.5, PW, 1.2, 'F');

  // Badge legal
  y = 12;
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, 98, 6.5, 1.5, 1.5, 'FD');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 138);
  doc.text('INSTRUMENTO LEGAL OFICIAL · LEY N° 21.719', margin + 3.5, y + 4.3);

  // Título del documento
  y = 26;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  const titleLines = doc.splitTextToSize(tpl.titulo, PW - margin * 2);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 6.5 + 2;

  // Subtítulo con el artículo legal
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(37, 99, 235);
  doc.text(tpl.articulo, margin, y);
  y += 7;

  // Tarjeta de Metadatos Ejecutivos
  const metaBoxH = 18;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, PW - margin * 2, metaBoxH, 2, 2, 'FD');

  const colWidth = (PW - margin * 2) / 3;
  // Columna 1: Empresa
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('EMPRESA / TITULAR', margin + 4, y + 5.5);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  const safeComp = companyName && companyName.trim() ? companyName : '[EMPRESA REGISTRADA]';
  doc.text(doc.splitTextToSize(safeComp, colWidth - 8)[0], margin + 4, y + 12);

  // Columna 2: Fecha de emisión
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('FECHA DE EMISIÓN', margin + colWidth + 4, y + 5.5);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(fecha, margin + colWidth + 4, y + 12);

  // Columna 3: Estado del documento
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('FINALIDAD', margin + colWidth * 2 + 4, y + 5.5);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(5, 150, 105);
  doc.text('Plantilla de Cumplimiento', margin + colWidth * 2 + 4, y + 12);

  y += metaBoxH + 8;

  // Propósito del documento (Callout con acento lateral)
  if (tpl.proposito) {
    const propLines = doc.splitTextToSize(tpl.proposito, PW - margin * 2 - 12);
    const propH = propLines.length * 4.2 + 10;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, PW - margin * 2, propH, 1.5, 1.5, 'FD');
    doc.setFillColor(37, 99, 235);
    doc.rect(margin, y, 2, propH, 'F');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(37, 99, 235);
    doc.text('OBJETIVO Y ALCANCE NORMATIVO:', margin + 6, y + 5);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(propLines, margin + 6, y + 9.5);

    y += propH + 8;
  }

  // Banner de Instrucción
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(191, 219, 254);
  doc.roundedRect(margin, y, PW - margin * 2, 8.5, 1.5, 1.5, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text('INSTRUCCIÓN: Complete los campos marcados entre corchetes [COMPLETAR] con la información verídica de su organización.', margin + 4, y + 5.5);
  y += 14;

  // ── Secciones y Cláusulas ──
  for (let sIdx = 0; sIdx < tpl.secciones.length; sIdx++) {
    const seccion = tpl.secciones[sIdx];
    checkY(32);

    // Encabezado de cláusula/sección con estilo legal
    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(seccion.titulo, margin, y);
    y += 5.5;

    // Instrucción para el redactor
    if (seccion.instruccion) {
      checkY(10);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 116, 139);
      const instrLines = doc.splitTextToSize(`» ${seccion.instruccion}`, PW - margin * 2);
      doc.text(instrLines, margin, y);
      y += instrLines.length * 4 + 3;
    }

    // Callout de justificación jurídica
    if (seccion.porQue) {
      const porQueLines = doc.splitTextToSize(seccion.porQue, PW - margin * 2 - 10);
      const boxH = porQueLines.length * 3.8 + 8;
      checkY(boxH + 5);
      doc.setFillColor(250, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, y, PW - margin * 2, boxH, 1.5, 1.5, 'FD');
      doc.setFillColor(100, 116, 139);
      doc.rect(margin, y, 1.5, boxH, 'F');

      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text('JUSTIFICACIÓN NORMATIVA APDP', margin + 5, y + 4.5);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(porQueLines, margin + 5, y + 8.5);
      y += boxH + 5;
    }

    // Contenido del modelo
    const lineas = seccion.placeholder.split('\n');
    for (const linea of lineas) {
      checkY(6);
      if (linea.trim() === '') {
        y += 2.5;
        continue;
      }

      const isPlaceholder = linea.includes('[COMPLETAR');
      if (isPlaceholder) {
        // Separar etiqueta del placeholder
        const parts = linea.split(':');
        if (parts.length >= 2) {
          const label = parts[0] + ':';
          const rest = parts.slice(1).join(':').trim();
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(30, 41, 59);
          doc.text(label, margin + 2, y);
          const labelW = doc.getTextWidth(label) + 2;

          doc.setFont('helvetica', 'normal');
          doc.setTextColor(37, 99, 235);
          const valLines = doc.splitTextToSize(rest, PW - margin * 2 - labelW - 4);
          doc.text(valLines, margin + 2 + labelW, y);
          y += valLines.length * 4.8 + 1;
        } else {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(37, 99, 235);
          const pLines = doc.splitTextToSize(linea, PW - margin * 2 - 4);
          doc.text(pLines, margin + 2, y);
          y += pLines.length * 4.8 + 1;
        }
      } else {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 41, 59);
        const wrapped = doc.splitTextToSize(linea, PW - margin * 2 - 4);
        doc.text(wrapped, margin + 2, y);
        y += wrapped.length * 4.8 + 1;
      }
    }

    // Divisor sutil
    checkY(10);
    doc.setDrawColor(241, 245, 249);
    doc.line(margin, y + 3, PW - margin, y + 3);
    y += 8;
  }

  // ── Bloque Formal de Firmas (para documentos que lo ameritan) ──
  checkY(45);
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, PW - margin, y);
  y += 8;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('FORMALIZACIÓN Y SUSCRIPCIÓN:', margin, y);
  y += 18;

  const signW = (PW - margin * 2 - 15) / 2;
  // Firma 1
  doc.setDrawColor(100, 116, 139);
  doc.line(margin, y, margin + signW, y);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('POR EL RESPONSABLE', margin, y + 4.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Nombre / Representante Legal:\nRUT:\nFecha: ____ / ____ / ________', margin, y + 8.5);

  // Firma 2
  doc.line(margin + signW + 15, y, PW - margin, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('POR EL ENCARGADO / TESTIGO', margin + signW + 15, y + 4.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Nombre / Cargo:\nRUT:\nFecha: ____ / ____ / ________', margin + signW + 15, y + 8.5);

  y += 24;

  // ── Checklist de Verificación Final ──
  checkY(24);
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(margin, y, PW - margin * 2, 7.5, 1.5, 1.5, 'FD');
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 101, 52);
  doc.text('Lista de Verificación antes de implementar:', margin + 4, y + 5);
  y += 11;

  for (const item of tpl.checklist) {
    checkY(7);
    doc.setDrawColor(148, 163, 184);
    doc.roundedRect(margin, y - 2.8, 3.2, 3.2, 0.5, 0.5);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    const itemLines = doc.splitTextToSize(item, PW - margin * 2 - 7);
    doc.text(itemLines, margin + 5.5, y);
    y += itemLines.length * 4.2 + 2;
  }
  y += 4;

  // ── Notas Legales ──
  checkY(20);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Notas y consideraciones legales:', margin, y);
  y += 5;

  for (const nota of tpl.notas) {
    checkY(6);
    doc.setFontSize(7.8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    const notaLines = doc.splitTextToSize(`• ${nota}`, PW - margin * 2);
    doc.text(notaLines, margin, y);
    y += notaLines.length * 3.8 + 1.5;
  }

  // ── Pie de página en todas las páginas ──
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(248, 250, 252);
    doc.rect(0, PH - 10, PW, 10, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(0, PH - 10, PW, PH - 10);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(
      'Documento generado por DataShield · No constituye asesoría jurídica vinculante · Válido para implementación bajo Ley N° 21.719.',
      margin, PH - 4,
    );
    doc.setFont('helvetica', 'bold');
    doc.text(`Página ${i} de ${totalPages}`, PW - margin, PH - 4, { align: 'right' });
  }

  doc.save(`plantilla_${reqId}_${companyName.replace(/[^a-z0-9]/gi, '_') || 'empresa'}.pdf`);
}

// ────────────────────────────────────────────────────────────
// 3. INFORME EJECUTIVO DE RIESGOS PARA DIRECTORIO Y GERENCIA
// ────────────────────────────────────────────────────────────
export const VALOR_UTM_CLP = 66500; // Valor oficial de referencia UTM en Chile

export async function generarInformeEjecutivoPDF(
  companyName: string,
  results: Record<string, RequisitoResult>,
  uploadedDocs: Record<string, UploadedDoc>,
  sector?: Sector | null,
): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const margin = 18;
  let y = 0;

  const { pct, green, yellow, red, unanalyzable, wrong_type, pending, analyzable } = calcPct(results);
  const totalWords = Object.values(uploadedDocs).reduce((acc, d) => acc + (d.wordCount ?? 0), 0);
  const docsCount = Object.keys(uploadedDocs).length;

  const totalExposureUTM = REQUISITOS.reduce((acc, r) => {
    const estado = results[r.id]?.estado;
    if (estado === 'red' || estado === 'yellow') {
      return acc + parseInt(r.multa.replace(/\D/g, ''), 10);
    }
    return acc;
  }, 0);
  const totalExposureCLP = totalExposureUTM * VALOR_UTM_CLP;

  const sectorBench = sector && SECTOR_DATA[sector] ? SECTOR_DATA[sector] : SECTOR_DATA['otro'];
  const fecha = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });

  // ══════════════════════════════════════════════════════════
  // PÁGINA 1 — PORTADA EJECUTIVA Y TABLERO DE CONTROL
  // ══════════════════════════════════════════════════════════

  // Encabezado institucional
  doc.setFillColor(...C.navy);
  doc.rect(0, 0, PW, 46, 'F');

  doc.setTextColor(...C.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('DATASHIELD', margin, 18);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 215, 245);
  doc.text('INFORME EJECUTIVO DE CUMPLIMIENTO — LEY N° 21.719', margin, 26);
  doc.setFontSize(8.5);
  doc.text('Presentación Oficial para Directorio y Alta Gerencia', margin, 32);

  doc.setFontSize(8);
  doc.setTextColor(...C.gray);
  doc.text(`Fecha de Emisión: ${fecha}`, PW - margin, 18, { align: 'right' });
  doc.text('Clasificación: CONFIDENCIAL / USO INTERNO', PW - margin, 25, { align: 'right' });
  doc.text(`Identificador Empresa: ${companyName}`, PW - margin, 32, { align: 'right' });

  y = 54;

  // Banner Informativo Empresa
  doc.setFillColor(...C.bgGray);
  doc.roundedRect(margin, y, PW - margin * 2, 12, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.text);
  doc.text(`Entidad Auditada: ${companyName}`, margin + 6, y + 7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...C.text2);
  doc.text(`Sector Industrial: ${sectorBench.label} · Evidencias analizadas: ${docsCount} doc(s) (${totalWords.toLocaleString('es-CL')} palabras)`, PW - margin - 6, y + 7.5, { align: 'right' });

  y += 18;

  // 4 KPI Cards Ejecutivas (2 columnas x 2 filas)
  const cardW = (PW - margin * 2 - 8) / 2;
  const cardH = 26;

  // Card 1: Nivel de Cumplimiento
  const scoreColor = pct >= 75 ? C.green : pct >= 40 ? C.yellow : C.red;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...C.lightGray);
  doc.roundedRect(margin, y, cardW, cardH, 2, 2, 'FD');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.text2);
  doc.text('ÍNDICE DE CUMPLIMIENTO GLOBAL', margin + 6, y + 7);
  doc.setFontSize(20);
  doc.setTextColor(...scoreColor);
  doc.text(`${pct}%`, margin + 6, y + 18);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...C.text2);
  const estadoMsg = pct >= 75 ? 'Óptimo (Riesgo Bajo)' : pct >= 40 ? 'Medio (Acción Preventiva)' : 'Crítico (Exposición Inmediata)';
  doc.text(estadoMsg, margin + 35, y + 17);

  // Card 2: Exposición Financiera Máxima
  const card2X = margin + cardW + 8;
  doc.roundedRect(card2X, y, cardW, cardH, 2, 2, 'FD');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.text2);
  doc.text('EXPOSICIÓN FINANCIERA EN MULTAS (MÁX)', card2X + 6, y + 7);
  doc.setFontSize(16);
  doc.setTextColor(...C.red);
  doc.text(`${totalExposureUTM.toLocaleString('es-CL')} UTM`, card2X + 6, y + 17);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...C.text2);
  doc.text(`≈ $${Math.round(totalExposureCLP / 1_000_000).toLocaleString('es-CL')} millones CLP`, card2X + 6, y + 23);

  y += cardH + 6;

  // Card 3: Brechas Críticas
  doc.roundedRect(margin, y, cardW, cardH, 2, 2, 'FD');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.text2);
  doc.text('ESTADO DE REQUISITOS OBLIGATORIOS', margin + 6, y + 7);
  doc.setFontSize(13);
  doc.setTextColor(...C.text);
  doc.text(`${green} Cumplidos · ${yellow} Parciales · ${red} Faltantes`, margin + 6, y + 17);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...C.text2);
  doc.text(`De un universo de 10 requisitos normativos obligatorios`, margin + 6, y + 23);

  // Card 4: Benchmark Sectorial
  doc.roundedRect(card2X, y, cardW, cardH, 2, 2, 'FD');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.text2);
  doc.text(`POSICIÓN RESPECTO AL SECTOR ${sectorBench.label.toUpperCase()}`, card2X + 6, y + 7);
  const difSector = pct - sectorBench.promedio;
  const difColor = difSector >= 0 ? C.green : C.red;
  doc.setFontSize(14);
  doc.setTextColor(...difColor);
  doc.text(`${difSector >= 0 ? '+' : ''}${difSector} pts`, card2X + 6, y + 17);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...C.text2);
  doc.text(`Su empresa: ${pct}% · Promedio industria: ${sectorBench.promedio}%`, card2X + 6, y + 23);

  y += cardH + 10;

  // Título de la tabla
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...C.navy);
  doc.text('Matriz Ejecutiva de Riesgos y Sanciones por Requisito Legal', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.text2);
  doc.text('Clasificación conforme a los Artículos de la Ley N° 21.719 y escala de multas aplicable por la APDP', margin, y + 4.5);

  y += 7;

  // Tabla Ejecutiva de Requisitos
  const tableRows = REQUISITOS.map(r => {
    const res = results[r.id];
    const estado = res?.estado ?? 'red';
    const multaNum = parseInt(r.multa.replace(/\D/g, ''), 10);
    const multaCLP = (multaNum * VALOR_UTM_CLP) / 1_000_000;
    const estadoStr = estado === 'green' ? 'CUMPLE' : estado === 'yellow' ? 'PARCIAL' : 'CRÍTICO';
    const exposicionStr = (estado === 'red' || estado === 'yellow')
      ? `$${multaCLP.toFixed(1)}M CLP`
      : 'Riesgo mitigado';

    return [
      r.num,
      r.nombre,
      r.art,
      r.multa,
      estadoStr,
      exposicionStr,
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['N°', 'Requisito Legal', 'Artículo', 'Multa Máx.', 'Estado', 'Exposición Fin.']],
    body: tableRows,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 2, textColor: C.text },
    headStyles: { fillColor: C.navy, textColor: C.white, fontStyle: 'bold', fontSize: 7.5 },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 50 },
      2: { cellWidth: 42 },
      3: { cellWidth: 24, halign: 'center' },
      4: { cellWidth: 22, halign: 'center' },
      5: { cellWidth: 26, halign: 'right' },
    },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 4) {
        const val = String(data.cell.raw);
        if (val === 'CUMPLE') {
          data.cell.styles.textColor = C.green;
          data.cell.styles.fontStyle = 'bold';
        } else if (val === 'PARCIAL') {
          data.cell.styles.textColor = C.yellow;
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = C.red;
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  // ══════════════════════════════════════════════════════════
  // PÁGINA 2 — HOJA DE RUTA PRIORITARIA Y ACREDITACIÓN FORMAL
  // ══════════════════════════════════════════════════════════
  doc.addPage();

  // Subheader Página 2
  doc.setFillColor(...C.navy);
  doc.rect(0, 0, PW, 16, 'F');
  doc.setTextColor(...C.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('DATASHIELD — PLAN DE ACCIÓN EJECUTIVO Y FIRMAS FORMALES', margin, 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Empresa: ${companyName}`, PW - margin, 11, { align: 'right' });

  y = 26;

  // Sección 1: Hoja de Ruta Prioritaria
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...C.navy);
  doc.text('1. Hoja de Ruta Prioritaria de Remediación (Top Acciones Urgentes)', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.text2);
  doc.text('La subsanación prioritaria de las siguientes brechas mitiga el mayor porcentaje de exposición a sanciones:', margin, y + 5);

  y += 10;

  // Filtrar las brechas ordenadas por monto de multa
  const brechasOrdenadas = REQUISITOS.filter(r => {
    const estado = results[r.id]?.estado;
    return estado === 'red' || estado === 'yellow';
  }).sort((a, b) => {
    const mA = parseInt(a.multa.replace(/\D/g, ''), 10);
    const mB = parseInt(b.multa.replace(/\D/g, ''), 10);
    return mB - mA;
  }).slice(0, 3);

  if (brechasOrdenadas.length === 0) {
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(...C.green);
    doc.roundedRect(margin, y, PW - margin * 2, 16, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...C.green);
    doc.text('Excelente: No se detectan brechas criticas pendientes.', margin + 8, y + 10);
    y += 24;
  } else {
    brechasOrdenadas.forEach((br, idx) => {
      const multaNum = parseInt(br.multa.replace(/\D/g, ''), 10);
      const clpAprox = (multaNum * VALOR_UTM_CLP) / 1_000_000;
      doc.setFillColor(...C.bgGray);
      doc.setDrawColor(...C.lightGray);
      doc.roundedRect(margin, y, PW - margin * 2, 20, 2, 2, 'FD');

      // Círculo número
      doc.setFillColor(...C.navy);
      doc.circle(margin + 7, y + 10, 4, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...C.white);
      doc.text(String(idx + 1), margin + 7, y + 12.5, { align: 'center' });

      // Texto de la acción
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...C.navy);
      doc.text(`Subsanar: ${br.nombre} (${br.art})`, margin + 16, y + 7.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...C.text2);
      doc.text(`Exigencia legal: ${br.legalDetail.exigenciaSimple.slice(0, 105)}...`, margin + 16, y + 12.5);

      // Reducción de riesgo en badge
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...C.red);
      doc.text(`Riesgo: ${br.multa} (~$${clpAprox.toFixed(1)}M CLP)`, PW - margin - 6, y + 7.5, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.green);
      doc.text('Plantilla disponible en DataShield', PW - margin - 6, y + 14, { align: 'right' });

      y += 24;
    });
  }

  y += 6;

  // Sección 2: Integridad y Trazabilidad de Evidencia
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...C.navy);
  doc.text('2. Registro de Integridad y Trazabilidad Documental', margin, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.text2);
  const docInfo = docsCount > 0
    ? `Se procesaron y validaron criptográficamente ${docsCount} documento(s) aportado(s) por la empresa, aislados bajo tenant ID verificado.`
    : 'No se han adjuntado documentos formales aún. El diagnóstico actual se basa en los requisitos normativos pendientes.';
  doc.text(docInfo, margin, y);
  y += 5;
  doc.text('La bitácora de auditoría inmutable asociada cuenta con encadenamiento criptográfico SHA-256 según estándares de compliance.', margin, y);

  y += 18;

  // Sección 3: Acreditación Legal y Bloque de Firmas
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...C.navy);
  doc.text('3. Declaración de Validez y Bloque de Firmas', margin, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.text2);
  const disclaimer = 'El presente informe ejecutivo ha sido emitido con fines de diagnóstico y gestión interna de riesgos de privacidad, reflejando el estado de cumplimiento observado en la plataforma DataShield. Se recomienda que las medidas adoptadas sean formalizadas por el Oficial de Privacidad / DPO y puestas en conocimiento del Directorio.';
  const linesDisc = doc.splitTextToSize(disclaimer, PW - margin * 2);
  doc.text(linesDisc, margin, y);
  y += linesDisc.length * 3.5 + 18;

  // Bloque con 2 firmas (DPO y Representante Legal)
  const signW = (PW - margin * 2 - 20) / 2;

  // Firma 1
  doc.setDrawColor(...C.gray);
  doc.setLineWidth(0.4);
  doc.line(margin, y, margin + signW, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C.navy);
  doc.text('OFICIAL DE CUMPLIMIENTO / DPO', margin + signW / 2, y + 5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.text2);
  doc.text('Responsable de Protección de Datos', margin + signW / 2, y + 9, { align: 'center' });
  doc.text(`${companyName}`, margin + signW / 2, y + 13, { align: 'center' });

  // Firma 2
  const sign2X = margin + signW + 20;
  doc.line(sign2X, y, sign2X + signW, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C.navy);
  doc.text('REPRESENTANTE LEGAL / GERENCIA GENERAL', sign2X + signW / 2, y + 5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.text2);
  doc.text('Aprobación de Hoja de Ruta y Presupuesto', sign2X + signW / 2, y + 9, { align: 'center' });
  doc.text(`${companyName}`, sign2X + signW / 2, y + 13, { align: 'center' });

  // Pie de página en ambas páginas
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(248, 250, 252);
    doc.rect(0, PH - 9, PW, 9, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(0, PH - 9, PW, PH - 9);

    doc.setFontSize(6.8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(
      'DataShield · Resumen Ejecutivo Ley 21.719 · Estrictamente Confidencial · No constituye patrocinio letrado directo',
      margin, PH - 3.5,
    );
    doc.setFont('helvetica', 'bold');
    doc.text(`Página ${i} de ${totalPages}`, PW - margin, PH - 3.5, { align: 'right' });
  }

  const safeFileName = `informe_ejecutivo_directorio_${companyName.toLowerCase().replace(/[^a-z0-9]/gi, '_') || 'empresa'}.pdf`;
  doc.save(safeFileName);
}
