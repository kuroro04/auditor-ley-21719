'use client';
import React, { useState } from 'react';
import { REQUISITOS } from '@/lib/requisitos';
import { calcPct } from '@/lib/metrics';
import type { RequisitoResult, UploadedDoc, UserRole } from '@/lib/types';
import TemplateDropdown from './TemplateDropdown';

interface TableroSubsanacionProps {
  results: Record<string, RequisitoResult>;
  uploadedDocs: Record<string, UploadedDoc>;
  companyName: string;
  role: UserRole;
  canEdit: boolean;
  canDownload: boolean;
  onTriggerUpload: (reqId: string) => void;
  onSelectReq: (reqId: string) => void;
  onToast: (msg: string, type: 'green' | 'blue' | 'yellow') => void;
  onOpenComparator?: () => void;
  hasPrevResults?: boolean;
}

export default function TableroSubsanacion({
  results,
  uploadedDocs,
  companyName,
  canEdit,
  canDownload,
  onTriggerUpload,
  onSelectReq,
  onToast,
  onOpenComparator,
  hasPrevResults,
}: TableroSubsanacionProps) {
  const [filtroTexto, setFiltroTexto] = useState('');

  const stats = calcPct(results);

  // Clasificar los 10 requisitos en 3 columnas de subsanación
  const reqsFaltantes = REQUISITOS.filter(r => {
    const est = results[r.id]?.estado;
    return est === 'red' || est === 'wrong_type' || est === 'unanalyzable' || !est;
  });

  const reqsRevision = REQUISITOS.filter(r => {
    const est = results[r.id]?.estado;
    return est === 'yellow' || est === 'pending';
  });

  const reqsCumplidos = REQUISITOS.filter(r => {
    const est = results[r.id]?.estado;
    return est === 'green';
  });

  // Filtrado por texto si el usuario busca algo específico
  const coincideFiltro = (r: typeof REQUISITOS[0]) => {
    if (!filtroTexto.trim()) return true;
    const term = filtroTexto.toLowerCase();
    return r.nombre.toLowerCase().includes(term) || r.art.toLowerCase().includes(term);
  };

  return (
    <div className="tablero-subsanacion">
      {/* Barra superior de progreso de subsanación */}
      <div className="tablero-header-card">
        <div className="tablero-kpi-summary">
          <div>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--navy)' }}>
              Tablero de Subsanación — Ley 21.719
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text2)' }}>
              Gestión visual de documentos y tareas para alcanzar el 100% de cumplimiento
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {hasPrevResults && onOpenComparator && (
              <button
                type="button"
                className="btn-comparar-subsanacion"
                onClick={onOpenComparator}
                title="Comparar con versión anterior"
              >
                ⚖️ Comparar Versiones
              </button>
            )}
            <div className="tablero-search-wrap">
              <input
                type="text"
                placeholder="Buscar requisito..."
                value={filtroTexto}
                onChange={e => setFiltroTexto(e.target.value)}
                className="tablero-search-input"
              />
              {filtroTexto && (
                <button
                  type="button"
                  className="tablero-search-clear"
                  onClick={() => setFiltroTexto('')}
                  aria-label="Limpiar búsqueda"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Medidor visual de avance */}
        <div className="tablero-progress-section">
          <div className="tablero-progress-labels">
            <span>
              <strong>{stats.green} de {REQUISITOS.length} requisitos</strong> totalmente completados ({stats.pct}%)
            </span>
            <span style={{ color: stats.red > 0 ? 'var(--red)' : 'var(--green)' }}>
              {stats.red > 0 ? `⚠️ ${stats.red} brechas críticas pendientes` : '✓ 0 brechas críticas'}
            </span>
          </div>
          <div className="tablero-progress-bar">
            <div
              className="tablero-progress-fill"
              style={{
                width: `${stats.pct}%`,
                background: stats.pct >= 80 ? 'var(--green)' : stats.pct >= 50 ? 'var(--yellow)' : 'var(--blue)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Columnas del tablero Kanban */}
      <div className="tablero-columns-grid">
        {/* Columna 1: Faltantes / Críticos */}
        <div className="tablero-column col-faltantes">
          <div className="tablero-col-header">
            <div className="tablero-col-title-group">
              <span className="tablero-col-dot red" />
              <span className="tablero-col-title">Faltantes / Críticos</span>
            </div>
            <span className="tablero-col-count red">{reqsFaltantes.length}</span>
          </div>
          <p className="tablero-col-desc">Documentos no subidos o con vacíos legales graves (&lt;50%).</p>

          <div className="tablero-cards-list">
            {reqsFaltantes.filter(coincideFiltro).length === 0 ? (
              <div className="tablero-empty-col">
                <span>🎉</span>
                <p>No hay requisitos críticos pendientes en esta categoría.</p>
              </div>
            ) : (
              reqsFaltantes.filter(coincideFiltro).map(r => {
                const doc = uploadedDocs[r.id];
                const res = results[r.id];
                const cob = res?.cobertura ?? 0;
                return (
                  <div key={r.id} className="tablero-card red">
                    <div className="tablero-card-top">
                      <span className="tablero-card-art">{r.art.split('—')[0].trim()}</span>
                      <span className="tablero-card-multa" title="Multa máxima">{r.multa}</span>
                    </div>

                    <h4 className="tablero-card-title">{r.nombre}</h4>

                    <div className="tablero-card-doc">
                      {doc ? (
                        <span className="tablero-doc-name" title={doc.name}>📄 {doc.name}</span>
                      ) : (
                        <span className="tablero-doc-missing">✕ Sin documento subido</span>
                      )}
                    </div>

                    <div className="tablero-card-prog-wrap">
                      <div className="tablero-card-pct">{cob}% cobertura</div>
                      <div className="tablero-card-bar">
                        <div className="tablero-card-bar-fill red" style={{ width: `${cob}%` }} />
                      </div>
                    </div>

                    <div className="tablero-card-actions">
                      {canDownload && (
                        <TemplateDropdown
                          reqId={r.id}
                          companyName={companyName}
                          onToast={onToast}
                        />
                      )}
                      {canEdit && (
                        <button
                          type="button"
                          className="btn-tablero-upload"
                          onClick={() => onTriggerUpload(r.id)}
                          title="Subir documento corregido"
                        >
                          📤 Subir
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn-tablero-detail"
                        onClick={() => onSelectReq(r.id)}
                        title="Ver detalle de criterios"
                      >
                        🔍
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Columna 2: En Revisión / Borrador */}
        <div className="tablero-column col-revision">
          <div className="tablero-col-header">
            <div className="tablero-col-title-group">
              <span className="tablero-col-dot yellow" />
              <span className="tablero-col-title">En Revisión / Borrador</span>
            </div>
            <span className="tablero-col-count yellow">{reqsRevision.length}</span>
          </div>
          <p className="tablero-col-desc">Documentos presentes pero con criterios pendientes o confianza media.</p>

          <div className="tablero-cards-list">
            {reqsRevision.filter(coincideFiltro).length === 0 ? (
              <div className="tablero-empty-col">
                <span>👌</span>
                <p>No hay documentos en revisión intermedia.</p>
              </div>
            ) : (
              reqsRevision.filter(coincideFiltro).map(r => {
                const doc = uploadedDocs[r.id];
                const res = results[r.id];
                const cob = res?.cobertura ?? 0;
                const pendientes = res ? res.criterios.filter(c => c.status !== 'ok').length : 0;
                return (
                  <div key={r.id} className="tablero-card yellow">
                    <div className="tablero-card-top">
                      <span className="tablero-card-art">{r.art.split('—')[0].trim()}</span>
                      <span className="tablero-card-multa" title="Multa máxima">{r.multa}</span>
                    </div>

                    <h4 className="tablero-card-title">{r.nombre}</h4>

                    <div className="tablero-card-doc">
                      {doc ? (
                        <span className="tablero-doc-name" title={doc.name}>📄 {doc.name}</span>
                      ) : (
                        <span className="tablero-doc-name">Documento cargado</span>
                      )}
                    </div>

                    <div className="tablero-card-prog-wrap">
                      <div className="tablero-card-pct">{cob}% cobertura ({pendientes} pendiente{pendientes !== 1 ? 's' : ''})</div>
                      <div className="tablero-card-bar">
                        <div className="tablero-card-bar-fill yellow" style={{ width: `${cob}%` }} />
                      </div>
                    </div>

                    <div className="tablero-card-actions">
                      {canDownload && (
                        <TemplateDropdown
                          reqId={r.id}
                          companyName={companyName}
                          onToast={onToast}
                        />
                      )}
                      {canEdit && (
                        <button
                          type="button"
                          className="btn-tablero-upload"
                          onClick={() => onTriggerUpload(r.id)}
                          title="Subir nueva versión corregida"
                        >
                          📤 Reemplazar
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn-tablero-detail"
                        onClick={() => onSelectReq(r.id)}
                        title="Ver qué cláusulas faltan"
                      >
                        🔍 Ver qué falta
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Columna 3: Cumplidos / Al Día */}
        <div className="tablero-column col-cumplidos">
          <div className="tablero-col-header">
            <div className="tablero-col-title-group">
              <span className="tablero-col-dot green" />
              <span className="tablero-col-title">Cumplidos / Al Día</span>
            </div>
            <span className="tablero-col-count green">{reqsCumplidos.length}</span>
          </div>
          <p className="tablero-col-desc">Documentos que satisfacen el 100% de los criterios exigidos por la ley.</p>

          <div className="tablero-cards-list">
            {reqsCumplidos.filter(coincideFiltro).length === 0 ? (
              <div className="tablero-empty-col">
                <span>📋</span>
                <p>Aún no hay documentos completados al 100%.</p>
              </div>
            ) : (
              reqsCumplidos.filter(coincideFiltro).map(r => {
                const doc = uploadedDocs[r.id];
                const res = results[r.id];
                const cob = res?.cobertura ?? 100;
                return (
                  <div key={r.id} className="tablero-card green">
                    <div className="tablero-card-top">
                      <span className="tablero-card-art">{r.art.split('—')[0].trim()}</span>
                      <span className="tablero-card-pill green">✓ Conforme</span>
                    </div>

                    <h4 className="tablero-card-title">{r.nombre}</h4>

                    <div className="tablero-card-doc">
                      {doc ? (
                        <span className="tablero-doc-name" title={doc.name}>📄 {doc.name}</span>
                      ) : (
                        <span className="tablero-doc-name">✓ Documento validado</span>
                      )}
                    </div>

                    <div className="tablero-card-prog-wrap">
                      <div className="tablero-card-pct" style={{ color: 'var(--green)' }}>100% cumplimiento</div>
                      <div className="tablero-card-bar">
                        <div className="tablero-card-bar-fill green" style={{ width: '100%' }} />
                      </div>
                    </div>

                    <div className="tablero-card-actions">
                      <button
                        type="button"
                        className="btn-tablero-detail"
                        style={{ width: '100%' }}
                        onClick={() => onSelectReq(r.id)}
                      >
                        ✓ Ver evidencia auditada
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
