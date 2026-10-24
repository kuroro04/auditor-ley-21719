/**
 * Genera los fixtures binarios para los tests de extracción de texto.
 * Ejecutar una sola vez: node scripts/generate-test-fixtures.mjs
 * Los archivos generados se versionan en __tests__/fixtures/.
 */
import JSZip from 'jszip';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dir, '../__tests__/fixtures');
mkdirSync(OUT, { recursive: true });

// ── 1. PDF mínimo con texto extraíble ────────────────────────────────────────
// PDF 1.4 válido con una página y un fragmento de texto en Helvetica.
// Los offsets de xref se calculan manualmente para que el parser no indexe.
const pdfContent =
  '%PDF-1.4\n' +
  '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
  '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
  '3 0 obj<</Type/Page/MediaBox[0 0 400 200]/Parent 2 0 R' +
    '/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n' +
  '4 0 obj<</Length 60>>stream\n' +
  'BT /F1 12 Tf 20 160 Td (Politica de privacidad DataShield) Tj ET\n' +
  'endstream\nendobj\n' +
  '5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n' +
  'xref\n0 6\n' +
  '0000000000 65535 f\r\n' +
  '0000000009 00000 n\r\n' +
  '0000000058 00000 n\r\n' +
  '0000000115 00000 n\r\n' +
  '0000000274 00000 n\r\n' +
  '0000000395 00000 n\r\n' +
  'trailer<</Size 6/Root 1 0 R>>\nstartxref\n465\n%%EOF\n';

writeFileSync(resolve(OUT, 'sample.pdf'), Buffer.from(pdfContent, 'latin1'));
console.log('✓ sample.pdf');

// ── 2. XLSX mínimo con una hoja y texto extraíble ────────────────────────────
const zip = new JSZip();

zip.file('[Content_Types].xml',
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
    '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>' +
  '</Types>');

zip.folder('_rels').file('.rels',
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
  '</Relationships>');

zip.folder('xl').file('workbook.xml',
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"' +
    ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheets><sheet name="Datos" sheetId="1" r:id="rId1"/></sheets>' +
  '</workbook>');

zip.folder('xl/_rels').file('workbook.xml.rels',
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>' +
  '</Relationships>');

// Hoja con dos celdas: A1="Responsable de datos" B1="DataShield SA"
zip.folder('xl/worksheets').file('sheet1.xml',
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetData>' +
      '<row r="1">' +
        '<c r="A1" t="s"><v>0</v></c>' +
        '<c r="B1" t="s"><v>1</v></c>' +
      '</row>' +
    '</sheetData>' +
  '</worksheet>');

zip.folder('xl').file('sharedStrings.xml',
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="2" uniqueCount="2">' +
    '<si><t>Responsable de datos</t></si>' +
    '<si><t>DataShield SA</t></si>' +
  '</sst>');

const xlsxBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
writeFileSync(resolve(OUT, 'sample.xlsx'), xlsxBuf);
console.log('✓ sample.xlsx');

// ── 3. Archivo .xls (OLE2 legacy) — para verificar rechazo ──────────────────
// Solo necesitamos los 8 magic bytes del formato OLE2 (Compound Document).
const oleHeader = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, ...new Array(504).fill(0)]);
writeFileSync(resolve(OUT, 'sample.xls'), oleHeader);
console.log('✓ sample.xls (magic bytes OLE2)');
