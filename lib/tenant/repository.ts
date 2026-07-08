import type { UploadedDoc } from '../types';
import type { TenantContext } from './context';
import { assertTenantAccess } from './guard';

interface StoredDocument extends UploadedDoc {
  companyId: string;
}

interface CompanyRecord {
  documents: Record<string, StoredDocument>;
}

// Simula el almacén de backend multi-tenant: una tabla lógica separada por
// companyId, análoga a filtrar siempre por "WHERE company_id = :companyId"
// en una base de datos real.
let db = new Map<string, CompanyRecord>();

function getOrCreateRecord(companyId: string): CompanyRecord {
  let rec = db.get(companyId);
  if (!rec) {
    rec = { documents: {} };
    db.set(companyId, rec);
  }
  return rec;
}

export function saveDocument(ctx: TenantContext, reqId: string, doc: UploadedDoc): void {
  const rec = getOrCreateRecord(ctx.companyId);
  rec.documents[reqId] = { ...doc, companyId: ctx.companyId };
}

// Simula GET /companies/:ownerCompanyId/documents/:reqId — ownerCompanyId
// representa lo que vendría en la ruta de la petición. assertTenantAccess
// verifica que coincida con la empresa de la sesión antes de devolver
// cualquier dato: ningún documento sale del repositorio sin pasar el guard.
export function getDocument(ctx: TenantContext, ownerCompanyId: string, reqId: string): UploadedDoc {
  assertTenantAccess(ctx, ownerCompanyId, `Intento de leer el documento "${reqId}" de otra empresa`);
  const rec = db.get(ownerCompanyId);
  const stored = rec?.documents[reqId];
  if (!stored) throw new Error(`Documento "${reqId}" no encontrado para la empresa ${ownerCompanyId}`);
  const { companyId, ...doc } = stored;
  return doc;
}

// Devuelve únicamente los documentos de la propia empresa del contexto:
// no requiere companyId como parámetro porque siempre usa el de la sesión.
export function listDocuments(ctx: TenantContext): Record<string, UploadedDoc> {
  const rec = db.get(ctx.companyId);
  if (!rec) return {};
  const result: Record<string, UploadedDoc> = {};
  for (const [reqId, stored] of Object.entries(rec.documents)) {
    const { companyId, ...doc } = stored;
    result[reqId] = doc;
  }
  return result;
}

// Uso exclusivo en pruebas: limpia el almacén simulado entre tests.
export function resetRepository(): void {
  db = new Map();
}
