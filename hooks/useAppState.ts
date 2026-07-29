'use client';
import { useState, useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Screen, ActiveTab, UploadedDoc, RequisitoResult, UserRole, AuditEvent, Sector, HistorialSnapshot } from '@/lib/types';
import { REQUISITOS, CHECKLIST_VERSION_LABEL } from '@/lib/requisitos';
import { analyzeDocument } from '@/lib/analyzer';
import { TOUR_STEP_COUNT } from '@/lib/tourConfig';
import { calcPct } from '@/lib/metrics';
import { buildCompanyId, type TenantContext } from '@/lib/tenant/context';
import { saveDocument, listDocuments } from '@/lib/tenant/repository';
import { getSecurityAuditLog, type SecurityEvent } from '@/lib/tenant/guard';
import { getRoleForUser } from '@/lib/userRoles';
import { enriquecerConSemantica } from '@/lib/semantic/semanticMatcher';

// Calcula los resultados del análisis para un conjunto de documentos.
// Única fuente de esta lógica: la usan tanto el flujo real (finishAnalysis)
// como el modo demostración (demo), para que ambos calculen igual.
function computeResults(docs: Record<string, UploadedDoc>): Record<string, RequisitoResult> {
  const results: Record<string, RequisitoResult> = {};
  REQUISITOS.forEach(r => {
    results[r.id] = analyzeDocument(r.id, docs);
  });
  return results;
}

// Enriquece los resultados con la capa semántica en segundo plano, requisito
// por requisito, sin bloquear la interfaz. Si el modelo de embeddings no
// está disponible (aún cargando cuando se llama, o falló al cargar), cada
// requisito simplemente se queda con el resultado del motor de reglas.
async function enhanceResultsInBackground(
  docs: Record<string, UploadedDoc>,
  baseResults: Record<string, RequisitoResult>,
  setResults: Dispatch<SetStateAction<Record<string, RequisitoResult>>>,
) {
  for (const req of REQUISITOS) {
    const doc = docs[req.id];
    const base = baseResults[req.id];
    if (!doc || !base || doc.scanned || !doc.text) continue;
    try {
      const enriquecido = await enriquecerConSemantica(req, base, doc);
      setResults(prev => ({ ...prev, [req.id]: enriquecido }));
    } catch {
      // Modelo de análisis semántico no disponible: este requisito se queda
      // con el resultado del motor de reglas, sin bloquear los demás.
    }
  }
}

// RUT sintético y estable usado solo para el modo demo: permite que los
// documentos de ejemplo también queden aislados bajo un companyId propio.
const DEMO_RUT = '99.999.999-9';

const DEMO_DOCS: Record<string, UploadedDoc> = {
  politica_privacidad: {
    name: 'politica_privacidad_v2.pdf',
    text: 'responsable rut domicilio contacto finalidad propósito consentimiento base legal acceso rectificación cancelación oposición derechos arco conservación retención plazo eliminar transferencia internacional',
  },
  registro_actividades: {
    name: 'registro_actividades.xlsx',
    text: 'categorías tipos de datos destinatarios encargados terceros supresión eliminación plazo seguridad cifrado medidas finalidad propósito',
  },
  contrato_encargado: {
    name: 'contrato_encargado_v1.docx',
    text: 'objeto duración instrucciones confidencialidad secreto medidas seguridad',
  },
};

// Contador global para IDs únicos de eventos de auditoría
let auditCounter = 0;

export function useAppState() {
  const [screen, setScreen] = useState<Screen>('landing');
  const [activeTab, setActiveTab] = useState<ActiveTab>('subir');
  const [companyName, setCompanyName] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [role, setRole] = useState<UserRole>('administrador');
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, UploadedDoc>>({});
  const [results, setResults] = useState<Record<string, RequisitoResult>>({});
  const [analyzed, setAnalyzed] = useState(false);
  const [auditLog, setAuditLog] = useState<AuditEvent[]>([]);
  // Espejo, para la UI, del log de seguridad global de lib/tenant/guard.ts.
  // Se sincroniza tras cada operación que pase por el guard de acceso.
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [sector, setSector]                   = useState<Sector>('otro');
  const [previousResults, setPreviousResults] = useState<Record<string, RequisitoResult>>({});
  const [tourActive, setTourActive]           = useState(false);
  const [tourStep, setTourStep]               = useState(0);
  const [snapshots, setSnapshots] = useState<HistorialSnapshot[]>([]);

  // Registra un evento en el audit log (más reciente primero)
  const addAuditEvent = useCallback((
    accion: AuditEvent['accion'],
    currentRole: UserRole,
    currentUser: string,
    archivo?: string,
    detalle?: string,
  ) => {
    setAuditLog(prev => [{
      id: ++auditCounter,
      timestamp: new Date().toISOString(),
      rol: currentRole,
      usuario: currentUser,
      accion,
      archivo,
      detalle,
    }, ...prev]);
  }, []);

  const login = useCallback((rut: string, email: string, selectedSector: Sector = 'otro') => {
    // El rol NUNCA lo elige el usuario en la interfaz: se resuelve aquí,
    // después de "autenticar", a partir de su correo. En producción esta
    // línea sería reemplazada por una llamada al backend (p.ej. GET /me)
    // que devuelve el rol guardado en la base de datos para ese usuario.
    const resolvedRole = getRoleForUser(email);
    setCompanyName(rut);
    setCompanyId(buildCompanyId(rut));
    setRole(resolvedRole);
    setSector(selectedSector);
    setTourActive(true);
    setTourStep(0);
    setScreen('app');
    setActiveTab('subir');
  }, []);

  const demo = useCallback((demoRole: UserRole) => {
    setCompanyName('Empresa Demo S.A.');
    setCompanyId(buildCompanyId(DEMO_RUT));
    setRole(demoRole);
    setSector('tecnologia');
    // Los documentos de ejemplo también deben quedar en el almacén aislado por
    // empresa (no solo en el estado de React), para que finishAnalysis --que
    // ahora siempre lee desde listDocuments()-- pueda encontrarlos.
    const demoCtx: TenantContext = {
      companyId: buildCompanyId(DEMO_RUT),
      companyName: 'Empresa Demo S.A.',
      role: demoRole,
      usuario: 'Empresa Demo S.A.',
    };
    Object.entries(DEMO_DOCS).forEach(([reqId, doc]) => saveDocument(demoCtx, reqId, doc));
    setUploadedDocs(DEMO_DOCS);

    // El demo ya viene "analizado" sin importar el rol elegido, para que
    // auditor/visualizador también puedan ver un diagnóstico completo aunque
    // no tengan permiso para ejecutar el análisis ellos mismos.
    const demoResults = computeResults(DEMO_DOCS);
    const { pct, green: greenCount, yellow: yellowCount, red: redCount } = calcPct(demoResults);
    setResults(demoResults);
    setAnalyzed(true);
    void enhanceResultsInBackground(DEMO_DOCS, demoResults, setResults);
    setSnapshots([{
      fecha: new Date().toISOString(),
      pct,
      green: greenCount,
      yellow: yellowCount,
      red: redCount,
      checklistVersion: CHECKLIST_VERSION_LABEL,
    }]);

    setTourActive(true);
    setTourStep(0);
    setScreen('app');
    setActiveTab('subir');
  }, []);

  const logout = useCallback(() => {
    setCompanyName('');
    setCompanyId('');
    setSecurityEvents([]);
    setRole('administrador');
    setSector('otro');
    setUploadedDocs({});
    setResults({});
    setPreviousResults({});
    setAnalyzed(false);
    setScreen('landing');
    setActiveTab('subir');
    setAuditLog([]);
    setSnapshots([]);
    setTourActive(false);
    setTourStep(0);
    auditCounter = 0;
  }, []);

  const uploadDoc = useCallback((reqId: string, doc: UploadedDoc, currentRole: UserRole, currentUser: string) => {
    // Todo documento se persiste en el almacén aislado por empresa (lib/tenant/repository),
    // etiquetado con el companyId de la sesión activa, nunca con uno provisto por el llamador.
    const ctx: TenantContext = { companyId, companyName: currentUser, role: currentRole, usuario: currentUser };
    saveDocument(ctx, reqId, doc);
    setUploadedDocs(prev => ({ ...prev, [reqId]: doc }));
    addAuditEvent('subió documento', currentRole, currentUser, doc.name);
    // Refleja en la UI cualquier evento de seguridad relacionado con esta empresa
    // (quedará vacío mientras no exista ningún intento de acceso cruzado).
    setSecurityEvents(getSecurityAuditLog().filter(
      e => e.companyIdSolicitante === ctx.companyId || e.companyIdRecurso === ctx.companyId,
    ));
  }, [addAuditEvent, companyId]);

  const startAnalysis = useCallback(() => {
    // Guardar resultados actuales como "versión anterior" antes de re-analizar
    if (analyzed) {
      setPreviousResults(results);
    }
    setTourActive(false);
    setScreen('analyzing');
  }, [analyzed, results]);

  const finishAnalysis = useCallback((
    currentRole: UserRole,
    currentUser: string,
  ) => {
    const ctx: TenantContext = { companyId, companyName: currentUser, role: currentRole, usuario: currentUser };
    // El motor de análisis nunca recibe documentos "tal cual" desde el llamador:
    // siempre se re-obtienen desde el almacén aislado por empresa, así ningún
    // componente puede saltarse el filtro por companyId ni analizar datos ajenos.
    const docsAislados = listDocuments(ctx);
    const newResults = computeResults(docsAislados);
    setSecurityEvents(getSecurityAuditLog().filter(
      e => e.companyIdSolicitante === ctx.companyId || e.companyIdRecurso === ctx.companyId,
    ));

    // Calcular métricas para el snapshot histórico usando la función centralizada
    const { pct, green: greenCount, yellow: yellowCount, red: redCount } = calcPct(newResults);

    setSnapshots(prev => [...prev, {
      fecha: new Date().toISOString(),
      pct,
      green: greenCount,
      yellow: yellowCount,
      red: redCount,
      checklistVersion: CHECKLIST_VERSION_LABEL,
    }]);

    setResults(newResults);
    setAnalyzed(true);
    setTourActive(false);
    setScreen('app');
    setActiveTab('diagnostico');
    addAuditEvent('ejecutó análisis', currentRole, currentUser);
    // Capa semántica: se aplica en segundo plano, sin bloquear la pantalla
    // de diagnóstico que el usuario ya está viendo con los resultados de reglas.
    void enhanceResultsInBackground(docsAislados, newResults, setResults);
    // companyId debe estar en las dependencias: de lo contrario este callback queda
    // memorizado con el companyId inicial ('') y listDocuments() nunca encontraría
    // los documentos guardados bajo el companyId real de la sesión.
  }, [addAuditEvent, companyId]);

  const logDownload = useCallback((currentRole: UserRole, currentUser: string) => {
    addAuditEvent('descargó informe', currentRole, currentUser, 'informe_cumplimiento.pdf');
  }, [addAuditEvent]);

  const logUploadRejected = useCallback((
    currentRole: UserRole,
    currentUser: string,
    fileName: string,
    reason: string,
  ) => {
    addAuditEvent('documento rechazado', currentRole, currentUser, fileName, reason);
  }, [addAuditEvent]);

  const switchTab = useCallback((tab: ActiveTab, isAnalyzed: boolean): boolean => {
    if (tab === 'diagnostico' && !isAnalyzed) return false;
    setActiveTab(tab);
    // Cerrar el tour al cambiar de pestaña: no debe seguir en Riesgos, Registro, etc.
    setTourActive(false);
    return true;
  }, []);

  const advanceTour = useCallback(() => {
    setTourStep(prev => {
      if (prev >= TOUR_STEP_COUNT - 1) {
        setTourActive(false);
        return 0;
      }
      return prev + 1;
    });
  }, []);

  const skipTour = useCallback(() => {
    setTourActive(false);
    setTourStep(0);
  }, []);

  return {
    screen, activeTab, companyName, companyId, role, sector, uploadedDocs, results,
    previousResults, analyzed, auditLog, securityEvents, snapshots, tourActive, tourStep,
    login, demo, logout, uploadDoc, startAnalysis, finishAnalysis,
    switchTab, logDownload, logUploadRejected, advanceTour, skipTour,
  };
}


