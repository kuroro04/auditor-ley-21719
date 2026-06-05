'use client';
import { useAppState } from '@/hooks/useAppState';
import { useToast } from '@/hooks/useToast';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import Landing from '@/components/Landing';
import AppShell from '@/components/AppShell';
import AnalyzingScreen from '@/components/AnalyzingScreen';
import Toast from '@/components/Toast';

export default function Home() {
  const state = useAppState();
  const { toasts, toast } = useToast();

  useSessionTimeout(
    () => toast('Su sesión expirará en 1 minuto por inactividad', 'yellow'),
    () => { state.logout(); toast('Sesión cerrada por inactividad', 'yellow'); },
    state.screen === 'app',
  );

  return (
    <>
      {state.screen === 'landing' && (
        <Landing
          onLogin={(rut, role, sector) => {
            state.login(rut, role, sector);
            toast('✓ Bienvenido. Suba sus documentos para comenzar el diagnóstico.', 'blue');
          }}
          onDemo={() => {
            state.demo();
            toast('✓ Modo demo activado con 3 documentos de ejemplo.', 'blue');
          }}
          onToast={toast}
        />
      )}

      {state.screen === 'analyzing' && (
        <AnalyzingScreen
          docCount={Object.keys(state.uploadedDocs).length}
          onFinish={() => {
            state.finishAnalysis(state.uploadedDocs, state.role, state.companyName);
            toast('✓ Análisis completado. Revise su diagnóstico.', 'green');
          }}
        />
      )}

      {state.screen === 'app' && (
        <AppShell
          companyName={state.companyName}
          role={state.role}
          auditLog={state.auditLog}
          activeTab={state.activeTab}
          uploadedDocs={state.uploadedDocs}
          results={state.results}
          analyzed={state.analyzed}
          onSwitchTab={tab => {
            const ok = state.switchTab(tab, state.analyzed);
            if (!ok) toast('Primero suba documentos y ejecute el análisis', 'yellow');
          }}
          onUpload={(reqId, doc) => state.uploadDoc(reqId, doc, state.role, state.companyName)}
          onStartAnalysis={() => {
            if (Object.keys(state.uploadedDocs).length === 0) {
              toast('Suba al menos 1 documento primero', 'yellow');
              return;
            }
            state.startAnalysis();
          }}
          onLogout={state.logout}
          onDownload={() => {
            state.logDownload(state.role, state.companyName);
            toast('📊 Generando informe PDF — funcionalidad en producción', 'blue');
          }}
          onToast={toast}
        />
      )}

      <Toast toasts={toasts} />
    </>
  );
}
