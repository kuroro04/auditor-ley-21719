'use client';

import { TEMPLATES } from './templateContent';

// Descarga una plantilla Word (.docx) para el requisito indicado
export async function descargarPlantillaDocx(reqId: string, companyName: string): Promise<void> {
  const tpl = TEMPLATES[reqId];
  if (!tpl) throw new Error(`No existe plantilla para ${reqId}`);

  // Importación dinámica para evitar problemas con SSR
  const {
    Document, Packer, Paragraph, TextRun, HeadingLevel,
    AlignmentType, BorderStyle,
  } = await import('docx');

  const fecha = new Date().toLocaleDateString('es-CL', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  // ── Función auxiliar: párrafo con borde inferior (separador) ──
  const separador = () => new Paragraph({
    text: '',
    border: {
      bottom: { color: 'CCCCCC', space: 1, style: BorderStyle.SINGLE, size: 6 },
    },
    spacing: { after: 200 },
  });

  // ── Construir secciones del documento ──
  const children: InstanceType<typeof Paragraph>[] = [];

  // Encabezado institucional
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        new TextRun({ text: 'DataShield · Ley 21.719', bold: true, size: 22, color: '0F1E3D' }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        new TextRun({ text: tpl.articulo, size: 18, color: '4A5880', italics: true }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [
        new TextRun({ text: `Empresa: ${companyName || '[NOMBRE EMPRESA]'}  ·  Fecha: ${fecha}`, size: 18, color: '4A5880' }),
      ],
    }),
  );

  // Título principal
  children.push(
    new Paragraph({
      text: tpl.titulo,
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    }),
    separador(),
  );

  // Propósito del documento
  children.push(
    new Paragraph({
      spacing: { before: 200, after: 400 },
      children: [
        new TextRun({ text: 'Propósito: ', bold: true, size: 20 }),
        new TextRun({ text: tpl.proposito, size: 20 }),
      ],
    }),
  );

  // Secciones
  for (const seccion of tpl.secciones) {
    children.push(
      new Paragraph({
        text: seccion.titulo,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 120 },
      }),
    );

    if (seccion.instruccion) {
      children.push(
        new Paragraph({
          spacing: { after: 120 },
          children: [
            new TextRun({ text: '📌 ', size: 18 }),
            new TextRun({ text: seccion.instruccion, size: 18, color: '6B7A99', italics: true }),
          ],
        }),
      );
    }

    // Convertir placeholder en líneas del documento
    const lineas = seccion.placeholder.split('\n');
    for (const linea of lineas) {
      if (linea.includes('[COMPLETAR') || linea === '[COMPLETAR]') {
        children.push(
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: linea,
                bold: true,
                underline: {},
                color: '2563EB',
                size: 20,
              }),
            ],
          }),
        );
      } else {
        children.push(
          new Paragraph({
            text: linea,
            spacing: { after: 80 },
          }),
        );
      }
    }
  }

  // Separador final y notas legales
  children.push(separador());
  children.push(
    new Paragraph({
      text: 'Notas legales:',
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 200, after: 100 },
    }),
  );
  for (const nota of tpl.notas) {
    children.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [
          new TextRun({ text: '• ', bold: true }),
          new TextRun({ text: nota, size: 18, color: '4A5880' }),
        ],
      }),
    );
  }

  // Pie de página
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400 },
      children: [
        new TextRun({
          text: 'Documento generado por DataShield · Ley 21.719 de Protección de Datos Personales · Este documento es una plantilla base y no constituye asesoría legal.',
          size: 16,
          color: '9CA3AF',
          italics: true,
        }),
      ],
    }),
  );

  const doc = new Document({
    sections: [{
      properties: {},
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `plantilla_${reqId}_${companyName.replace(/[^a-z0-9]/gi, '_') || 'empresa'}.docx`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
