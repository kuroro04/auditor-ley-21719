'use client';
import React, { useEffect } from 'react';
import { REQUISITOS } from '@/lib/requisitos';
import { calcPct } from '@/lib/metrics';
import type { RequisitoResult } from '@/lib/types';

interface ModalComparadorVersionesProps {
  currentResults: Record<string, RequisitoResult>;
  previousResults: Record<string, RequisitoResult>;
  companyName: string;
  onClose: () => void;
}

export default function ModalComparadorVersiones({
  currentResults,
  previousResults,
  companyName,
  onClose,
}: ModalComparadorVersionesProps) {
  // Manejo de tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const currStats = calcPct(currentResults);
  const prevStats = Object.keys(previousResults).length > 0
    ? calcPct(previousResults)
    : { pct: 0, green: 0, yellow: 0, red: 10, analyzable: 10 };

  const deltaPct = currStats.pct - prevStats.pct;
  const brechasResueltas = Math.max(0, prevStats.red - currStats.red);
  const nuevosCumplidos = Math.max(0, currStats.green - prevStats.green);

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-comp-title">
      <div className="modal-container modal-comparador" onClick={e => e.stopPropagation()}>
        {/* Cabecera del modal */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="modal-icon-badge" style={{ background: 'rgba(37,99,235,0.1)', color: 'var(--blue)' }}>
              ⚖️
            </span>
            <div>
              <h2 id="modal-comp-title" style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--navy)' }}>
                Comparador de Versiones — Evolución del Cumplimiento
              </h2>
              <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: 'var(--text2)' }}>
                Análisis comparativo de subsanación para {companyName || 'la empresa'}
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Cerrar comparador">
            ✕
          </button>
        </div>

        {/* Tarjetas KPI de evolución */}
        <div className="comp-kpi-grid">
          <div className="comp-kpi-card">
            <span className="comp-kpi-label">Cumplimiento Global</span>
            <div className="comp-kpi-val-row">
              <span className="comp-kpi-old">{prevStats.pct}%</span>
              <span className="comp-kpi-arrow">→</span>
              <span className="comp-kpi-new">{currStats.pct}%</span>
              <span className={`comp-kpi-delta ${deltaPct >= 0 ? 'positivo' : 'negativo'}`}>
                {deltaPct >= 0 ? `+${deltaPct}%` : `${deltaPct}%`}
              </span>
            </div>
            <span className="comp-kpi-hint">
              {deltaPct > 0 ? 'Progreso positivo alcanzado' : deltaPct === 0 ? 'Mismo nivel de cumplimiento' : 'Retroceso en requisitos'}
            </span>
          </div>

          <div className="comp-kpi-card">
            <span className="comp-kpi-label">Brechas Críticas Resueltas</span>
            <div className="comp-kpi-val-row">
              <span className="comp-kpi-big-number" style={{ color: brechasResueltas > 0 ? 'var(--green)' : 'var(--text)' }}>
                {brechasResueltas}
              </span>
              <span className="comp-kpi-subtext">de {prevStats.red} iniciales</span>
            </div>
            <span className="comp-kpi-hint">
              {currStats.red} {currStats.red === 1 ? 'brecha crítica pendiente' : 'brechas críticas pendientes'}
            </span>
          </div>

          <div className="comp-kpi-card">
            <span className="comp-kpi-label">Requisitos al Día (100%)</span>
            <div className="comp-kpi-val-row">
              <span className="comp-kpi-old">{prevStats.green}</span>
              <span className="comp-kpi-arrow">→</span>
              <span className="comp-kpi-new" style={{ color: 'var(--green)' }}>{currStats.green}</span>
              {nuevosCumplidos > 0 && (
                <span className="comp-kpi-delta positivo">+{nuevosCumplidos}</span>
              )}
            </div>
            <span className="comp-kpi-hint">Requisitos legales con estándar completo</span>
          </div>
        </div>

        {/* Tabla comparativa requisito por requisito */}
        <div className="comp-table-wrap">
          <table className="comp-table">
            <thead>
              <tr>
                <th>Requisito Legal</th>
                <th>Versión Anterior</th>
                <th>Versión Actual</th>
                <th>Evolución</th>
                <th>Criterios Subsanados en esta versión</th>
              </tr>
            </thead>
            <tbody>
              {REQUISITOS.map(r => {
                const prev = previousResults[r.id];
                const curr = currentResults[r.id];
                const prevCob = prev ? prev.cobertura : 0;
                const currCob = curr ? curr.cobertura : 0;
                const deltaCob = currCob - prevCob;

                const prevEst = prev?.estado ?? 'red';
                const currEst = curr?.estado ?? 'red';

                // Criterios que mejoraron de fail/warn a ok
                const criteriosGanados = curr && prev
                  ? curr.criterios.filter((c, i) =>
                      prev.criterios[i] &&
                      (prev.criterios[i].status === 'fail' || prev.criterios[i].status === 'warn') &&
                      c.status === 'ok'
                    )
                  : curr
                  ? curr.criterios.filter(c => c.status === 'ok')
                  : [];

                const getStatusPill = (est: string, cob: number) => {
                  if (est === 'green') return <span className="comp-pill green">✓ Al día ({cob}%)</span>;
                  if (est === 'yellow') return <span className="comp-pill yellow">⚠ En revisión ({cob}%)</span>;
                  return <span className="comp-pill red">✕ Crítico ({cob}%)</span>;
                };

                return (
                  <tr key={r.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '13px' }}>{r.nombre}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{r.art}</div>
                    </td>
                    <td>{getStatusPill(prevEst, prevCob)}</td>
                    <td>{getStatusPill(currEst, currCob)}</td>
                    <td>
                      {deltaCob > 0 ? (
                        <span className="comp-badge up">▲ +{deltaCob}%</span>
                      ) : deltaCob < 0 ? (
                        <span className="comp-badge down">▼ {deltaCob}%</span>
                      ) : (
                        <span className="comp-badge same">— Sin cambios</span>
                      )}
                    </td>
                    <td>
                      {criteriosGanados.length > 0 ? (
                        <div className="comp-criterios-list">
                          {criteriosGanados.map((c, idx) => (
                            <span key={idx} className="comp-criterio-tag">
                              ✓ {c.name}
                            </span>
                          ))}
                        </div>
                      ) : deltaCob === 0 && currCob === 100 ? (
                        <span style={{ fontSize: '12px', color: 'var(--green)' }}>✓ Manteniendo estándar</span>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--text3)' }}>Sin nuevos criterios</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pie del modal */}
        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '12px', color: 'var(--text2)' }}>
            💡 Las mejoras reflejan los criterios legales incorporados en sus documentos más recientes.
          </div>
          <button type="button" className="btn-primary" onClick={onClose}>
            Entendido, volver al diagnóstico
          </button>
        </div>
      </div>
    </div>
  );
}
