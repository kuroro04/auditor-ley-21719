'use client';
import { useState, useCallback } from 'react';
import type { Screen, ActiveTab, UploadedDoc, RequisitoResult, UserRole, AuditEvent, Sector, HistorialSnapshot } from '@/lib/types';
import { REQUISITOS, CHECKLIST_VERSION_LABEL } from '@/lib/requisitos';
import { analyzeDocument } from '@/lib/analyzer';
import { TOUR_STEP_COUNT } from '@/lib/tourConfig';
import { calcPct } from '@/lib/metrics';
import { buildCompanyId, type TenantContext } from '@/lib/tenant/context';
import { saveDocument, listDocuments as listTenantDocuments } from '@/lib/tenant/repository';
import { getSecurityAuditLog, type SecurityEvent } from '@/lib/tenant/guard';
import { reportClientEvent } from '@/lib/api/audit';
import {
  completeOnboarding,
  loginUser,
  loginWithMfa,
  registerCompany as registerCompanyApi,
  type RegisterPayload,
  type SessionInfo,
} from '@/lib/api/auth';

export type AuthSource = 'backend' | 'demo' | null;

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
  // Distingue una sesión real (backend FastAPI) de una sesión de demostración
  // (100% local, sin backend) — usado por UploadView para decidir si además
  // de guardar localmente debe subir el archivo original al servidor.
  const [authSource, setAuthSource] = useState<AuthSource>(null);
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
  // Fase 5 — estado del segundo factor del usuario con sesión activa, y el
  // token corto que habilita el segundo paso del login (entre la validación
  // de la contraseña y la del código TOTP).
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [pendingMfaToken, setPendingMfaToken] = useState<string | null>(null);

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

  // Aplica una sesión ya obtenida del backend al estado de la app. Único
  // lugar donde se "entra": lo usan el login normal y el segundo paso del MFA.
  const applySession = useCallback((session: SessionInfo) => {
    setCompanyName(session.companyNombre);
    setCompanyId(session.companyId);
    setRole(session.role);
    setSector(session.companySector ?? 'otro');
    setAuthSource('backend');
    setMfaEnabled(session.mfaEnabled);
    setPendingMfaToken(null);
    // El tour solo se abre automáticamente la primera vez: si el backend ya
    // registra que este usuario lo vio (o lo cerró) antes, no se repite.
    setTourActive(!session.onboardingCompleted);
    setTourStep(0);
    setScreen('app');
    setActiveTab('subir');
  }, []);

  // El rol y el nombre de la empresa NUNCA se eligen en el cliente: vienen
  // siempre de la respuesta del backend, que a su vez los toma del JWT de
  // sesión (nunca de un parámetro que el frontend pudiera manipular).
  //
  // Fase 5 — si el usuario tiene segundo factor, la contraseña sola no entra:
  // devuelve { mfaRequired: true } y guarda el token corto; el segundo paso
  // se completa con completeMfaLogin().
  const login = useCallback(async (email: string, password: string): Promise<{ mfaRequired: boolean }> => {
    const result = await loginUser(email, password);
    if (result.mfaRequired) {
      setPendingMfaToken(result.mfaToken);
      return { mfaRequired: true };
    }
    applySession(result.session);
    return { mfaRequired: false };
  }, [applySession]);

  // Segundo paso del login con MFA: canjea el token corto + el código de la
  // app de autenticación (o un código de respaldo) por la sesión real.
  const completeMfaLogin = useCallback(async (code: string) => {
    if (!pendingMfaToken) throw new Error('No hay un desafío MFA pendiente');
    const session = await loginWithMfa(pendingMfaToken, code);
    applySession(session);
  }, [pendingMfaToken, applySession]);

  // Refleja en el estado un cambio de MFA hecho desde el panel de seguridad.
  const notifyMfaChanged = useCallback((enabled: boolean) => {
    setMfaEnabled(enabled);
  }, []);

  const registerCompany = useCallback(async (payload: RegisterPayload) => {
    const session = await registerCompanyApi(payload);
    setCompanyName(session.companyNombre);
    setCompanyId(session.companyId);
    setRole(session.role);
    setSector(session.companySector ?? payload.sector);
    setAuthSource('backend');
    setTourActive(!session.onboardingCompleted);
    setTourStep(0);
    setScreen('app');
    setActiveTab('subir');
  }, []);

  const demo = useCallback((demoRole: UserRole) => {
    setCompanyName('Empresa Demo S.A.');
    setCompanyId(buildCompanyId(DEMO_RUT));
    setRole(demoRole);
    setSector('tecnologia');
    setAuthSource('demo');
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
    setAuthSource(null);
    setMfaEnabled(false);
    setPendingMfaToken(null);
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

  // Avisa al backend que el usuario ya vio (o cerró) el tour, para que no
  // vuelva a mostrarse automáticamente en su próximo inicio de sesión. Solo
  // aplica a sesiones reales: el modo demostración no tiene una cuenta
  // persistente contra la cual guardar la preferencia. Falla en silencio: en
  // el peor caso el tour reaparece una vez más, sin afectar el resto de la app.
  const marcarTourVistoSiCorresponde = useCallback((tourEstabaActivo: boolean, source: AuthSource) => {
    if (tourEstabaActivo && source === 'backend') {
      completeOnboarding().catch(() => {});
    }
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
    marcarTourVistoSiCorresponde(tourActive, authSource);
    setTourActive(false);
    setScreen('analyzing');
  }, [analyzed, results, tourActive, authSource, marcarTourVistoSiCorresponde]);

  const finishAnalysis = useCallback((
    currentRole: UserRole,
    currentUser: string,
  ) => {
    const ctx: TenantContext = { companyId, companyName: currentUser, role: currentRole, usuario: currentUser };
    // El motor de análisis nunca recibe documentos "tal cual" desde el llamador:
    // siempre se re-obtienen desde el almacén aislado por empresa, así ningún
    // componente puede saltarse el filtro por companyId ni analizar datos ajenos.
    const docsAislados = listTenantDocuments(ctx);
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
    marcarTourVistoSiCorresponde(tourActive, authSource);
    setTourActive(false);
    setScreen('app');
    setActiveTab('diagnostico');
    addAuditEvent('ejecutó análisis', currentRole, currentUser);
    // diagnostico_ejecutado es fail-open en el backend: si el aviso falla,
    // el análisis (que ya corrió en el navegador) se muestra igual.
    if (authSource === 'backend') {
      reportClientEvent('diagnostico_ejecutado').catch(() => {});
    }
    // companyId debe estar en las dependencias: de lo contrario este callback queda
    // memorizado con el companyId inicial ('') y listDocuments() nunca encontraría
    // los documentos guardados bajo el companyId real de la sesión.
  }, [addAuditEvent, companyId, tourActive, authSource, marcarTourVistoSiCorresponde]);

  // Lanza si el backend no pudo registrar la exportación (evento crítico,
  // fail-closed): quien llama no debe generar el PDF en ese caso.
  const logDownload = useCallback(async (currentRole: UserRole, currentUser: string) => {
    if (authSource === 'backend') {
      await reportClientEvent('exportacion_resultados');
    }
    addAuditEvent('descargó informe', currentRole, currentUser, 'informe_cumplimiento.pdf');
  }, [addAuditEvent, authSource]);

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
    marcarTourVistoSiCorresponde(tourActive, authSource);
    setTourActive(false);
    return true;
  }, [tourActive, authSource, marcarTourVistoSiCorresponde]);

  const advanceTour = useCallback(() => {
    setTourStep(prev => {
      if (prev >= TOUR_STEP_COUNT - 1) {
        marcarTourVistoSiCorresponde(true, authSource);
        setTourActive(false);
        return 0;
      }
      return prev + 1;
    });
  }, [authSource, marcarTourVistoSiCorresponde]);

  const skipTour = useCallback(() => {
    marcarTourVistoSiCorresponde(true, authSource);
    setTourActive(false);
    setTourStep(0);
  }, [authSource, marcarTourVistoSiCorresponde]);

  // Reabre el tour a pedido (botón "¿Cómo usar?" del header): útil si otra
  // persona nueva usa la cuenta, o si alguien quiere repasarlo. Siempre
  // vuelve a la pestaña "Subir documentos", que es donde vive el tour.
  const openTour = useCallback(() => {
    setActiveTab('subir');
    setTourStep(0);
    setTourActive(true);
  }, []);

  return {
    screen, activeTab, companyName, companyId, role, sector, authSource, uploadedDocs, results,
    previousResults, analyzed, auditLog, securityEvents, snapshots, tourActive, tourStep,
    mfaEnabled,
    login, completeMfaLogin, notifyMfaChanged, registerCompany, demo, logout, uploadDoc,
    startAnalysis, finishAnalysis,
    switchTab, logDownload, logUploadRejected, advanceTour, skipTour, openTour,
  };
}


