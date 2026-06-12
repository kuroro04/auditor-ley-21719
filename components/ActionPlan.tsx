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
        <span className="action-plan-icon">🎯</span>
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
                ⬆ Subir documento actualizado
              </button>
            ) : (
              <div className="role-lock-tag" style={{ marginTop: 6 }}>
                🔒 Solo Admin puede subir documentos
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
