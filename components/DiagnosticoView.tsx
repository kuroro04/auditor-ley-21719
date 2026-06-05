'use client';
import { useEffect, useRef, useState } from 'react';
import { REQUISITOS } from '@/lib/requisitos';
import type { RequisitoResult, UploadedDoc, UserRole, Sector } from '@/lib/types';
import LegalDetail from './LegalDetail';
import TemplateDropdown from './TemplateDropdown';
import SectorComparisonCard from './SectorComparisonCard';

interface DiagnosticoViewProps {
  results: Record<string, RequisitoResult>;
  previousResults: Record<string, RequisitoResult>;
  uploadedDocs: Record<string, UploadedDoc>;
  companyName: string;
  sector: Sector;
  role: UserRole;
  onUpload: (reqId: string, doc: UploadedDoc) => void;
  onDownload: () => void;
  onToast: (msg: string, type: 'green' | 'blue' | 'yellow') => void;
}

const CIRC = 2 * Math.PI * 44;

export default function DiagnosticoView({
  results, previousResults, uploadedDocs, companyName, sector, role,
  onUpload, onDownload, onToast,
}: DiagnosticoViewProps) {
  const circleRef = useRef<SVGCircleElement>(null);
  const [openCards, setOpenCards] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingReqId = useRef<string | null>(null);

  // Permisos por rol
  const canEdit     = role === 'administrador';                          // subir docs
  const canDownload = role === 'administrador' || role === 'auditor';   // descargar informe y plantillas

  // ── Metricas de cumplimiento ──
  const unanalyzable = REQUISITOS.filter(r => results[r.id]?.estado === 'unanalyzable').length;
  const analyzable   = REQUISITOS.length - unanalyzable;
  const green  = REQUISITOS.filter(r => results[r.id]?.estado === 'green').length;
  const yellow = REQUISITOS.filter(r => results[r.id]?.estado === 'yellow').length;
  const red    = REQUISITOS.filter(r => results[r.id]?.estado === 'red').length;

  const docsSubidos = Object.keys(uploadedDocs).length;
  const totalWords  = Object.values(uploadedDocs).reduce((acc, d) => acc + (d.wordCount ?? 0), 0);

  // Porcentaje solo sobre requisitos analizables
  const pct = analyzable > 0
    ? Math.round((green * 100 + yellow * 50) / (analyzable * 100) * 100)
    : 0;

  // Métricas de la versión anterior (solo si existe un snapshot previo)
  const hasPrevResults = Object.keys(previousResults).length > 0;
  const prevGreen   = hasPrevResults ? REQUISITOS.filter(r => previousResults[r.id]?.estado === 'green').length : 0;
  const prevYellow  = hasPrevResults ? REQUISITOS.filter(r => previousResults[r.id]?.estado === 'yellow').length : 0;
  const prevAnalyz  = hasPrevResults ? REQUISITOS.filter(r => previousResults[r.id]?.estado !== 'unanalyzable').length : 0;
  const prevPct     = prevAnalyz > 0
    ? Math.round((prevGreen * 100 + prevYellow * 50) / (prevAnalyz * 100) * 100)
    : 0;
  const versionDelta = pct - prevPct;

  const title = pct >= 80 ? 'Cumplimiento solido' : pct >= 50 ? 'Cumplimiento parcial' : 'Brechas criticas detectadas';
  const desc  = pct >= 80
    ? `Su empresa cumple ${pct}% de los requisitos analizados. Revise los ${red + yellow} puntos pendientes para alcanzar cumplimiento total.`
    : pct >= 50
      ? `Cumplimiento parcial (${pct}%). Existen ${red} documentos criticos faltantes que generan riesgo de multas de la APDP.`
      : `Cumplimiento bajo (${pct}%). Se recomienda accion inmediata. Hay ${red} brechas criticas que exponen a su empresa a multas graves.`;

  useEffect(() => {
    if (!circleRef.current) return;
    const t = setTimeout(() => {
      if (!circleRef.current) return;
      const offset = CIRC * (1 - pct / 100);
      circleRef.current.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)';
      circleRef.current.setAttribute('stroke-dashoffset', offset.toFixed(1));
      const color = pct >= 75 ? '#4ade80' : pct >= 40 ? '#fcd34d' : '#f87171';
      circleRef.current.setAttribute('stroke', color);
    }, 200);
    return () => clearTimeout(t);
  }, [pct]);

  const toggleCard = (id: string) =>
    setOpenCards(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const triggerUpload = (reqId: string) => {
    if (!canEdit) {
      onToast('Solo el administrador puede subir documentos', 'yellow');
      return;
    }
    pendingReqId.current = reqId;
    if (fileInputRef.current) { fileInputRef.current.value = ''; fileInputRef.current.click(); }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const reqId = pendingReqId.current;
    if (!file || !reqId) return;
    const finish = (text: string) => {
      onUpload(reqId, { name: file.name, text: text.toLowerCase() });
      onToast(`"${file.name}" actualizado`, 'green');
      pendingReqId.current = null;
    };
    if (file.type === 'text/plain') {
      const reader = new FileReader();
      reader.onload = ev => finish((ev.target?.result as string) || '');
      reader.readAsText(file);
    } else {
      setTimeout(() => finish(file.name), 800);
    }
  };

  // Ordenar: red -> yellow -> unanalyzable -> green
  const sorted = [...REQUISITOS].sort((a, b) => {
    const order: Record<string, number> = { red: 0, yellow: 1, unanalyzable: 2, green: 3 };
    return (order[results[a.id]?.estado ?? 'red'] ?? 0) - (order[results[b.id]?.estado ?? 'red'] ?? 0);
  });

  const multaReqs = REQUISITOS.filter(r => {
    const e = results[r.id]?.estado;
    return e === 'red' || e === 'yellow';
  });
  const plazoReqs = REQUISITOS.filter(r => results[r.id]?.estado !== 'green');

  const handleDownload = async () => {
    if (!canDownload) {
      onToast('El rol visualizador no puede descargar informes', 'yellow');
      return;
    }
    onDownload();
    onToast('Generando informe PDF...', 'blue');
    try {
      const { generarInformePDF } = await import('@/lib/pdfExport');
      await generarInformePDF(companyName, results, uploadedDocs);
      onToast('Informe PDF descargado', 'green');
    } catch {
      onToast('Error al generar el informe PDF', 'yellow');
    }
  };

  return (
    <div className="diagnostico-view">

      {/* Score banner */}
      <div className="score-banner">
        <div className="score-ring-wrap">
          <svg width="110" height="110" viewBox="0 0 110 110" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="55" cy="55" r="44" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
            <circle
              ref={circleRef}
              cx="55" cy="55" r="44" fill="none"
              stroke="#60a5fa" strokeWidth="8"
              strokeDasharray={CIRC.toFixed(1)}
              strokeDashoffset={CIRC.toFixed(1)}
              strokeLinecap="round"
            />
          </svg>
          <div className="score-center">
            <div className="score-big">{pct}%</div>
            <div className="score-label">cumplimiento</div>
          </div>
        </div>

        <div className="score-info">
          <h2>{title}</h2>
          <p>{desc}</p>
          {hasPrevResults && (
            <div className="score-version-compare">
              <span className="score-version-prev">Versión anterior: {prevPct}%</span>
              <span className="score-version-arrow">→</span>
              <span className="score-version-curr">Versión actual: {pct}%</span>
              <span className={`score-version-delta ${versionDelta >= 0 ? 'positivo' : 'negativo'}`}>
                {versionDelta >= 0 ? '+' : ''}{versionDelta}%
              </span>
            </div>
          )}
          {unanalyzable > 0 && (
            <div className="score-dual">
              <div className="score-dual-item confirmed">
                <span className="score-dual-value">{pct}%</span>
                <span className="score-dual-label">confirmado ({analyzable} analizados)</span>
              </div>
              <div className="score-dual-sep">·</div>
              <div className="score-dual-item unknown">
                <span className="score-dual-value">{unanalyzable}</span>
                <span className="score-dual-label">sin datos (escaneados)</span>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <div className="doc-chip" style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)' }}>
              {docsSubidos} documentos subidos
            </div>
            {totalWords > 0 && (
              <div className="doc-chip" style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)' }}>
                {totalWords.toLocaleString('es-CL')} palabras analizadas
              </div>
            )}
            <div className="doc-chip" style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)' }}>
              10 requisitos legales
            </div>
          </div>
        </div>

        <div className="score-sem">
          <div className="sem-mini green">
            <div className="sem-mini-dot" />
            <div><div className="sem-mini-count">{green}</div><div className="sem-mini-label">Al dia</div></div>
          </div>
          <div className="sem-mini yellow">
            <div className="sem-mini-dot" />
            <div><div className="sem-mini-count">{yellow}</div><div className="sem-mini-label">Incompleto</div></div>
          </div>
          <div className="sem-mini red">
            <div className="sem-mini-dot" />
            <div><div className="sem-mini-count">{red}</div><div className="sem-mini-label">Faltante</div></div>
          </div>
          {unanalyzable > 0 && (
            <div className="sem-mini gray">
              <div className="sem-mini-dot" />
              <div><div className="sem-mini-count">{unanalyzable}</div><div className="sem-mini-label">Sin datos</div></div>
            </div>
          )}
        </div>
      </div>

      {/* Comparación con el sector */}
      <SectorComparisonCard sector={sector} companyCumplimiento={pct} />

      {/* Detalle por requisito */}
      <div className="section-hdr">
        <h3>Detalle por requisito legal</h3>
        <span>Haga clic en cada requisito para ver el detalle</span>
      </div>

      <div className="brechas-list">
        {sorted.map(r => {
          const res = results[r.id];
          if (!res) return null;
          const { estado, cobertura, criterios, gap } = res;
          const isOpen    = openCards.has(r.id);
          const isScanned = estado === 'unanalyzable';
          const stateClass = isScanned ? 'state-unanalyzable' : `state-${estado}`;
          const icon       = estado === 'green' ? '✓' : estado === 'yellow' ? '⚠' : isScanned ? '⊘' : '✕';
          const gapColor   = estado === 'green' ? 'green' : estado === 'yellow' ? 'yellow' : isScanned ? 'gray' : 'red';
          const showTemplate = canDownload && (estado === 'red' || estado === 'yellow');

          const prevRes            = previousResults[r.id];
          const covDelta           = prevRes ? res.cobertura - prevRes.cobertura : 0;
          const criteriosMejorados = prevRes
            ? res.criterios.filter((c, i) =>
                prevRes.criterios[i] &&
                (prevRes.criterios[i].status === 'fail' || prevRes.criterios[i].status === 'warn') &&
                c.status === 'ok'
              )
            : [];

          return (
            <div key={r.id} className={`brecha-card ${stateClass}${isOpen ? ' open' : ''}`}>
              <div className="brecha-header" onClick={() => toggleCard(r.id)}>
                <div className="brecha-estado">{icon}</div>
                <div className="brecha-info">
                  <div className="brecha-name">{r.nombre}</div>
                  <div className="brecha-art">{r.art}</div>
                </div>
                <div className="brecha-progress-wrap">
                  <div className="brecha-pct">{isScanned ? '—' : `${cobertura}%`}</div>
                  {!isScanned && (
                    <div className="prog-bar">
                      <div className="prog-fill" style={{ width: `${cobertura}%` }} />
                    </div>
                  )}
                </div>
                <div className="brecha-chevron">▼</div>
              </div>

              {isOpen && (
                <div className="brecha-body">

                  {prevRes && (
                    <div className="version-comparison-banner">
                      <div className="version-comparison-scores">
                        <span className="version-prev-pct">Versión anterior: {prevRes.cobertura}%</span>
                        <span className="version-arrow">→</span>
                        <span className="version-curr-pct">Versión nueva: {res.cobertura}%</span>
                        <span className={`version-delta ${covDelta >= 0 ? 'positivo' : 'negativo'}`}>
                          {covDelta >= 0 ? '+' : ''}{covDelta}%
                        </span>
                      </div>
                      {criteriosMejorados.length > 0 && (
                        <div className="version-criterios-nuevos">
                          {criteriosMejorados.map((c, i) => (
                            <div key={i} className="version-criterio-check">
                              <span className="check-verde-anim">✓</span>
                              <span>{c.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {isScanned ? (
                    <div className="scanned-warning">
                      <div className="scanned-warning-icon">⚠️</div>
                      <div className="scanned-warning-text">
                        <strong>Este documento parece ser escaneado o una imagen.</strong> No pudimos extraer su texto para el analisis.
                        Por favor subalo en un formato con texto seleccionable (PDF con texto, Word o TXT).
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="criterios-list">
                        {criterios.map((c, i) => (
                          <div key={i} className="criterio-item">
                            <div className={`criterio-badge ${c.status}`}>
                              {c.status === 'ok' ? '✓' : c.status === 'warn' ? '~' : '✕'}
                            </div>
                            <div className="criterio-name">{c.name}</div>
                            <div className={`criterio-found ${c.status}`}>{c.found}</div>
                          </div>
                        ))}
                      </div>
                      <div className={`gap-box ${gapColor}`} style={{ marginTop: 10 }}>
                        <strong>
                          {estado === 'green' ? 'Cumple' : estado === 'yellow' ? 'Brecha detectada' : 'Documento faltante'}:
                        </strong>{' '}{gap}
                      </div>
                    </>
                  )}

                  {/* Ficha legal siempre visible al expandir */}
                  <LegalDetail requisito={r} />

                  {/* Acciones: solo si el estado no es verde */}
                  {estado !== 'green' && (
                    <div className="brecha-actions">
                      {canEdit ? (
                        <button className="btn-upload-req"
                          onClick={e => { e.stopPropagation(); triggerUpload(r.id); }}>
                          ⬆ {isScanned ? 'Reemplazar con documento de texto' : 'Subir documento actualizado'}
                        </button>
                      ) : (
                        <div className="role-lock-tag" title={`El rol "${role}" no puede subir documentos`}>
                          🔒 Solo Admin puede subir
                        </div>
                      )}
                      {showTemplate && (
                        <TemplateDropdown
                          reqId={r.id}
                          companyName={companyName}
                          onToast={onToast}
                        />
                      )}
                      {!canDownload && (estado === 'red' || estado === 'yellow') && (
                        <div className="role-lock-tag" title="El rol visualizador no puede generar plantillas">
                          🔒 Solo Admin/Auditor puede generar plantillas
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Panel de accion */}
      <div className="action-panel">
        <div className="action-card">
          <div className="action-card-title">Exposicion a multas APDP</div>
          {multaReqs.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--green)', padding: '8px 0' }}>Sin exposicion a multas</div>
          ) : (
            multaReqs.slice(0, 6).map(r => (
              <div key={r.id} className="multa-item">
                <div className={`multa-dot ${r.nivel === 'critico' || r.nivel === 'alto' ? 'alto' : 'medio'}`} />
                <div className="multa-name">{r.nombre}</div>
                <div className={`multa-utml ${r.nivel === 'critico' || r.nivel === 'alto' ? 'alto' : 'medio'}`}>{r.multa}</div>
              </div>
            ))
          )}
        </div>
        <div className="action-card">
          <div className="action-card-title">Plazos de cumplimiento</div>
          {plazoReqs.slice(0, 5).map(r => (
            <div key={r.id} className="plazo-item">
              <div className="plazo-date">{r.plazo.date}</div>
              <div className="plazo-info">
                <div className="plazo-title">{r.nombre}</div>
                <div className="plazo-sub">{r.art}</div>
              </div>
              <div className={`plazo-tag ${r.plazo.urgency}`}>
                {r.plazo.urgency === 'urgent' ? 'Urgente' : r.plazo.urgency === 'pronto' ? 'Pronto' : 'OK'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA descarga informe */}
      <div className="diag-cta">
        <div>
          <h3>Descargue su informe de cumplimiento</h3>
          <p>Documento PDF listo para presentar a directorio, abogados o la APDP</p>
        </div>
        {canDownload ? (
          <button className="btn-report" onClick={handleDownload}>
            Descargar informe PDF
          </button>
        ) : (
          <div className="role-lock-btn" title="El rol visualizador no puede descargar informes">
            🔒 Solo Admin/Auditor puede descargar
          </div>
        )}
      </div>

      <input ref={fileInputRef} type="file" style={{ display: 'none' }}
        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={handleFile} />
    </div>
  );
}
