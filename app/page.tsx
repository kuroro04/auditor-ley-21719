'use client';
import { useEffect } from 'react';
import { useAppState } from '@/hooks/useAppState';
import { useToast } from '@/hooks/useToast';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { ApiError } from '@/lib/api/client';
import { fetchMe } from '@/lib/api/auth';
import { listDocuments } from '@/lib/api/documents';
import { preloadEmbeddingModel } from '@/lib/semantic/embeddingModel';
import Landing from '@/components/Landing';
import AppShell from '@/components/AppShell';
import AnalyzingScreen from '@/components/AnalyzingScreen';
import Toast from '@/components/Toast';

export default function Home() {
  const state = useAppState();
  const { toasts, toast } = useToast();

  // Precarga en segundo plano del modelo de análisis semántico: arranca
  // apenas se monta la app (sin importar la pantalla activa), para que ya
  // esté listo cuando el usuario ejecute su primer análisis. No bloquea
  // nada — si el modelo aún no está listo cuando el usuario analiza, el
  // motor de reglas responde igual de inmediato.
  useEffect(() => {
    preloadEmbeddingModel();
  }, []);

  // Rehidratación de sesión activa (F5 / recarga del navegador)
  useEffect(() => {
    let cancelled = false;
    async function rehydrateSession() {
      try {
        const session = await fetchMe();
        if (!cancelled && session) {
          state.applySession(session);
          try {
            const docs = await listDocuments();
            if (!cancelled && docs.length > 0) {
              state.hydrateBackendDocuments(docs, session);
            }
          } catch (docErr) {
            console.error('[rehydrate] Error al sincronizar documentos:', docErr);
          }
        }
      } catch {
        // Sin sesión activa previa o cookie no válida: permanece en landing
      }
    }
    void rehydrateSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useSessionTimeout(
    () => toast('Su sesión expirará en 1 minuto por inactividad', 'yellow'),
    () => { void state.logout(); toast('Sesión cerrada por inactividad', 'yellow'); },
    state.screen === 'app',
  );

  return (
    <>
      {state.screen === 'landing' && (
        <Landing
          onLogin={async (email, password) => {
            try {
              const { mfaRequired } = await state.login(email, password);
              if (!mfaRequired) {
                toast('✓ Bienvenido. Suba sus documentos para comenzar el diagnóstico.', 'blue');
              }
              return { mfaRequired };
            } catch (err) {
              toast(err instanceof ApiError ? err.message : 'No se pudo iniciar sesión', 'yellow');
              return { mfaRequired: false };
            }
          }}
          onLoginMfa={async code => {
            try {
              await state.completeMfaLogin(code);
              toast('✓ Bienvenido. Suba sus documentos para comenzar el diagnóstico.', 'blue');
            } catch (err) {
              toast(err instanceof ApiError ? err.message : 'Código de verificación inválido', 'yellow');
            }
          }}
          onRegister={async payload => {
            try {
              await state.registerCompany(payload);
              toast('✓ Empresa registrada. Suba sus documentos para comenzar el diagnóstico.', 'blue');
            } catch (err) {
              toast(err instanceof ApiError ? err.message : 'No se pudo registrar la empresa', 'yellow');
            }
          }}
          onDemo={role => {
            state.demo(role);
            toast('✓ Modo demostración activado con 3 documentos de ejemplo.', 'blue');
          }}
          onToast={toast}
        />
      )}

      {state.screen === 'analyzing' && (
        <AnalyzingScreen
          docCount={Object.keys(state.uploadedDocs).length}
          onFinish={() => {
            state.finishAnalysis(state.role, state.companyName);
            toast('✓ Análisis completado. Revise su diagnóstico.', 'green');
          }}
        />
      )}

      {state.screen === 'app' && (
        <AppShell
          companyName={state.companyName}
          companyId={state.companyId}
          securityEvents={state.securityEvents}
          role={state.role}
          sector={state.sector}
          authSource={state.authSource}
          auditLog={state.auditLog}
          activeTab={state.activeTab}
          uploadedDocs={state.uploadedDocs}
          results={state.results}
          previousResults={state.previousResults}
          snapshots={state.snapshots}
          analyzed={state.analyzed}
          tourActive={state.tourActive}
          tourStep={state.tourStep}
          mfaEnabled={state.mfaEnabled}
          onMfaChanged={state.notifyMfaChanged}
          onSwitchTab={tab => {
            const ok = state.switchTab(tab, state.analyzed);
            if (!ok) toast('Primero suba documentos y ejecute el análisis', 'yellow');
          }}
          onUpload={(reqId, doc) => state.uploadDoc(reqId, doc, state.role, state.companyName)}
          onUploadRejected={(reqId, fileName, reason) =>
            state.logUploadRejected(state.role, state.companyName, fileName, reason)
          }
          onStartAnalysis={() => {
            if (Object.keys(state.uploadedDocs).length === 0) {
              toast('Suba al menos 1 documento primero', 'yellow');
              return;
            }
            state.startAnalysis();
          }}
          onLogout={state.logout}
          onDownload={() => state.logDownload(state.role, state.companyName)}
          onAdvanceTour={state.advanceTour}
          onSkipTour={state.skipTour}
          onOpenTour={state.openTour}
          onToast={toast}
        />
      )}

      <Toast toasts={toasts} />
    </>
  );
}
