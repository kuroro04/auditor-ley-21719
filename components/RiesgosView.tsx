'use client';
import { REQUISITOS } from '@/lib/requisitos';
import type { RequisitoResult } from '@/lib/types';
import { AlertCircleIcon, ClockIcon, CheckCircleIcon, XCircleIcon } from './Icons';

interface RiesgosViewProps {
  results: Record<string, RequisitoResult>;
  analyzed: boolean;
}

const NIVEL_ORDER = { critico: 0, alto: 1, medio: 2 };
const NIVEL_LABELS = { critico: 'Crítico', alto: 'Alto', medio: 'Medio' };

function parseMulta(multa: string): number {
  return parseInt(multa.replace(/\D/g, ''), 10) || 0;
}

export default function RiesgosView({ results, analyzed }: RiesgosViewProps) {
  const sorted = [...REQUISITOS].sort(
    (a, b) => NIVEL_ORDER[a.nivel] - NIVEL_ORDER[b.nivel]
  );

  const totalExposure = REQUISITOS.reduce((acc, r) => {
    if (!analyzed || results[r.id]?.estado !== 'green') {
      return acc + parseMulta(r.multa);
    }
    return acc;
  }, 0);

  const criticos = REQUISITOS.filter(r => r.nivel === 'critico').length;
  const altos    = REQUISITOS.filter(r => r.nivel === 'alto').length;
  const medios   = REQUISITOS.filter(r => r.nivel === 'medio').length;

  const incumplidos = analyzed
    ? REQUISITOS.filter(r => results[r.id]?.estado !== 'green').length
    : REQUISITOS.length;

  return (
    <div className="riesgos-view">
      {/* Summary cards */}
      <div className="riesgos-summary">
        <div className="riesgo-stat-card exposure">
          <div className="riesgo-stat-label">Exposición total a multas</div>
          <div className="riesgo-stat-value red">{totalExposure.toLocaleString('es-CL')} UTM</div>
          <div className="riesgo-stat-sub">
            {analyzed ? `basado en ${incumplidos} requisitos incumplidos` : 'si no cumple ningún requisito'}
          </div>
        </div>
        <div className="riesgo-stat-card critico">
          <div className="riesgo-stat-label">Requisitos críticos</div>
          <div className="riesgo-stat-value critico">{criticos}</div>
          <div className="riesgo-stat-sub">Multas de 3.000–5.000 UTM</div>
        </div>
        <div className="riesgo-stat-card alto">
          <div className="riesgo-stat-label">Requisitos de alto riesgo</div>
          <div className="riesgo-stat-value alto">{altos}</div>
          <div className="riesgo-stat-sub">Multas de 1.000–2.000 UTM</div>
        </div>
        <div className="riesgo-stat-card medio">
          <div className="riesgo-stat-label">Requisitos de riesgo medio</div>
          <div className="riesgo-stat-value medio">{medios}</div>
          <div className="riesgo-stat-sub">Multas de 500–1.000 UTM</div>
        </div>
      </div>

      {!analyzed && (
        <div className="riesgos-notice">
          <span className="riesgos-notice-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </span>
          Ejecute el análisis para ver su exposición real según los documentos subidos.
        </div>
      )}

      <div className="section-hdr" style={{ marginTop: 24 }}>
        <h3>Matriz de riesgo — ordenada por severidad</h3>
        <span>10 requisitos de la Ley 21.719</span>
      </div>

      <div className="riesgos-list">
        {sorted.map(r => {
          const res = analyzed ? results[r.id] : undefined;
          const estado = res?.estado;

          return (
            <div key={r.id} className={`riesgo-row nivel-${r.nivel}${estado ? ` estado-${estado}` : ''}`}>
              <div className={`riesgo-nivel-badge ${r.nivel}`}>{NIVEL_LABELS[r.nivel]}</div>
              <div className="riesgo-info">
                <div className="riesgo-nombre">{r.nombre}</div>
                <div className="riesgo-art">{r.art}</div>
              </div>
              <div className="riesgo-multa">
                <div className="riesgo-multa-value">{r.multa}</div>
                <div className="riesgo-multa-label">multa máx.</div>
              </div>
              {/* Urgencia y fecha en columnas separadas para evitar solapamiento */}
              <div className={`riesgo-plazo-urgencia ${r.plazo.urgency}`}>
                {r.plazo.urgency === 'urgent'
                  ? <><AlertCircleIcon size={11} /> Urgente</>
                  : r.plazo.urgency === 'pronto'
                    ? <><ClockIcon size={11} /> Pronto</>
                    : <><CheckCircleIcon size={11} /> Vigente</>}
              </div>
              <div className="riesgo-plazo-fecha">{r.plazo.date}</div>
              {analyzed && estado && (
                <div className={`riesgo-estado-chip ${estado}`}>
                  {estado === 'green'
                    ? <><CheckCircleIcon size={11} /> Cumple</>
                    : estado === 'yellow'
                      ? <><AlertCircleIcon size={11} /> Parcial</>
                      : <><XCircleIcon size={11} /> Falta</>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="riesgos-footer">
        <strong>Nota:</strong> Las multas corresponden a infracciones graves según la APDP (Agencia de Protección de Datos Personales).
        Los montos en UTM varían según el tipo y reincidencia de la infracción.
      </div>
    </div>
  );
}
