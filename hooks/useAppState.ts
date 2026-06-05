'use client';
import { useState, useCallback } from 'react';
import type { Screen, ActiveTab, UploadedDoc, RequisitoResult, UserRole, AuditEvent } from '@/lib/types';
import { REQUISITOS } from '@/lib/requisitos';
import { analyzeDocument } from '@/lib/analyzer';

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
  const [role, setRole] = useState<UserRole>('administrador');
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, UploadedDoc>>({});
  const [results, setResults] = useState<Record<string, RequisitoResult>>({});
  const [analyzed, setAnalyzed] = useState(false);
  const [auditLog, setAuditLog] = useState<AuditEvent[]>([]);

  // Registra un evento en el audit log (más reciente primero)
  const addAuditEvent = useCallback((
    accion: AuditEvent['accion'],
    currentRole: UserRole,
    currentUser: string,
    archivo?: string,
  ) => {
    setAuditLog(prev => [{
      id: ++auditCounter,
      timestamp: new Date().toISOString(),
      rol: currentRole,
      usuario: currentUser,
      accion,
      archivo,
    }, ...prev]);
  }, []);

  const login = useCallback((rut: string, selectedRole: UserRole) => {
    setCompanyName(rut);
    setRole(selectedRole);
    setScreen('app');
    setActiveTab('subir');
  }, []);

  const demo = useCallback(() => {
    setCompanyName('Empresa Demo S.A.');
    setRole('administrador');
    setUploadedDocs(DEMO_DOCS);
    setScreen('app');
    setActiveTab('subir');
  }, []);

  const logout = useCallback(() => {
    setCompanyName('');
    setRole('administrador');
    setUploadedDocs({});
    setResults({});
    setAnalyzed(false);
    setScreen('landing');
    setActiveTab('subir');
    setAuditLog([]);
    auditCounter = 0;
  }, []);

  const uploadDoc = useCallback((reqId: string, doc: UploadedDoc, currentRole: UserRole, currentUser: string) => {
    setUploadedDocs(prev => ({ ...prev, [reqId]: doc }));
    addAuditEvent('subió documento', currentRole, currentUser, doc.name);
  }, [addAuditEvent]);

  const startAnalysis = useCallback(() => {
    setScreen('analyzing');
  }, []);

  const finishAnalysis = useCallback((
    docs: Record<string, UploadedDoc>,
    currentRole: UserRole,
    currentUser: string,
  ) => {
    const newResults: Record<string, RequisitoResult> = {};
    REQUISITOS.forEach(r => {
      newResults[r.id] = analyzeDocument(r.id, docs);
    });
    setResults(newResults);
    setAnalyzed(true);
    setScreen('app');
    setActiveTab('diagnostico');
    addAuditEvent('ejecutó análisis', currentRole, currentUser);
  }, [addAuditEvent]);

  const logDownload = useCallback((currentRole: UserRole, currentUser: string) => {
    addAuditEvent('descargó informe', currentRole, currentUser, 'informe_cumplimiento.pdf');
  }, [addAuditEvent]);

  const switchTab = useCallback((tab: ActiveTab, isAnalyzed: boolean): boolean => {
    if (tab === 'diagnostico' && !isAnalyzed) return false;
    setActiveTab(tab);
    return true;
  }, []);

  return {
    screen, activeTab, companyName, role, uploadedDocs, results, analyzed, auditLog,
    login, demo, logout, uploadDoc, startAnalysis, finishAnalysis, switchTab, logDownload,
  };
}
