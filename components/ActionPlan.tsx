'use client';
import { ACTION_PLANS } from '@/lib/actionPlans';
import type { CriterioResult } from '@/lib/types';
import TemplateDropdown from './TemplateDropdown';

interface ActionPlanProps {
  reqId: string;
  companyName: string;
  criterios: CriterioResult[];
  onToast: (msg: string, type: 'green' | 'blue' | 'yellow') => void;
  onTriggerUpload: () => void;
  canEdit: boolean;
}

export default function ActionPlan({
  reqId,
  companyName,
  criterios,
  onToast,
  onTriggerUpload,
  canEdit,
}: ActionPlanProps) {
  const plan = ACTION_PLANS[reqId];
  if (!plan) return null;

  // Criterios que fallan o están incompletos: son los que el usuario debe corregir
  const criteriosFaltantes = criterios.filter(c => c.status === 'fail' || c.status === 'warn');

  return (
    <div className="action-plan">
      <div className="action-plan-header">
        <span className="action-plan-icon" aria-hidden="true">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
          </svg>
        </span>
        <span className="action-plan-title">Cómo corregir esto</span>
      </div>

      <div className="action-plan-steps">

        {/* Paso 1: Descargar plantilla */}
        <div className="action-step">
          <div className="action-step-number">1</div>
          <div className="action-step-content">
            <div className="action-step-titulo">{plan.paso1.titulo}</div>
            <div className="action-step-desc">{plan.paso1.descripcion}</div>
            <TemplateDropdown
              reqId={reqId}
              companyName={companyName}
              onToast={onToast}
            />
          </div>
        </div>

        {/* Paso 2: Completar campos faltantes (dinámico según criterios) */}
        <div className="action-step">
          <div className="action-step-number">2</div>
          <div className="action-step-content">
            <div className="action-step-titulo">
              {criteriosFaltantes.length > 0
                ? 'Completa las secciones que faltan en el documento'
                : 'Revisa y refuerza el contenido del documento'}
            </div>
            {criteriosFaltantes.length > 0 ? (
              <ul className="action-step-criterios">
                {criteriosFaltantes.map((c, i) => (
                  <li key={i} className={`action-criterio-item ${c.status}`}>
                    <span className="action-criterio-dot">
                      {c.status === 'fail' ? '✕' : '~'}
                    </span>
                    <span>{c.name}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="action-step-desc">
                El documento existe pero puede reforzarse con más detalle en los criterios marcados con advertencia.
              </div>
            )}
          </div>
        </div>

        {/* Paso 3: Subir el documento actualizado */}
        <div className="action-step">
          <div className="action-step-number">3</div>
          <div className="action-step-content">
            <div className="action-step-titulo">{plan.paso3.titulo}</div>
            <div className="action-step-desc">{plan.paso3.descripcion}</div>
            {canEdit ? (
              <button
                className="action-step-upload-btn"
                onClick={e => { e.stopPropagation(); onTriggerUpload(); }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Subir documento actualizado
              </button>
            ) : (
              <div className="role-lock-tag" style={{ marginTop: 6 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="11" width="18" height="11" rx="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                Solo Admin puede subir documentos
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
