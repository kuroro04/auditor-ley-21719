'use client';
import { useRef, useState } from 'react';
import { REQUISITOS } from '@/lib/requisitos';
import { extractDocumentText } from '@/lib/extractText';
import type { UploadedDoc, UserRole } from '@/lib/types';

interface UploadViewProps {
  uploadedDocs: Record<string, UploadedDoc>;
  role: UserRole;
  onUpload: (reqId: string, doc: UploadedDoc) => void;
  onStartAnalysis: () => void;
  onToast: (msg: string, type: 'green' | 'yellow' | 'blue') => void;
}

export default function UploadView({ uploadedDocs, role, onUpload, onStartAnalysis, onToast }: UploadViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingReqId = useRef<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  // Solo el administrador puede subir documentos y ejecutar el análisis
  const canEdit = role === 'administrador';

  const count = Object.keys(uploadedDocs).length;

  const triggerUpload = (reqId: string) => {
    if (!canEdit) {
      onToast('Solo el administrador puede subir documentos', 'yellow');
      return;
    }
    pendingReqId.current = reqId;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const reqId = pendingReqId.current;
    if (!file || !reqId) return;

    setUploading(reqId);
    const result = await extractDocumentText(file);
    onUpload(reqId, result);
    setUploading(null);

    const req = REQUISITOS.find(r => r.id === reqId);
    if (req) {
      const words = result.wordCount ?? 0;
      const info = result.extractedFully
        ? `${words.toLocaleString('es-CL')} palabras extraídas`
        : 'solo nombre de archivo';
      onToast(`✓ "${file.name}" cargado · ${info}`, 'green');
    }
    pendingReqId.current = null;
  };

  return (
    <div className="upload-view">
      {/* Step indicator */}
      <div className="step-indicator">
        <div className="step-item">
          <div className="step-num active">1</div>
          <div className="step-label active">Subir documentos</div>
        </div>
        <div className="step-connector" />
        <div className="step-item">
          <div className="step-num">2</div>
          <div className="step-label">Análisis automático</div>
        </div>
        <div className="step-connector" />
        <div className="step-item">
          <div className="step-num">3</div>
          <div className="step-label">Ver diagnóstico</div>
        </div>
      </div>

      {/* Hero */}
      <div className="upload-hero">
        <h2>Suba los documentos de su empresa</h2>
        <p>
          Para cada requisito de la Ley 21.719, suba el documento correspondiente.
          El sistema lee el contenido real de PDF, Word y Excel para analizarlo contra los criterios legales.
        </p>
      </div>

      {/* Grid */}
      <div className="req-upload-grid" data-tour="upload-zone">
        {REQUISITOS.map(r => {
          const doc = uploadedDocs[r.id];
          const isUploaded = !!doc;
          const isUploading = uploading === r.id;
          return (
            <div
              key={r.id}
              className={`req-upload-item${isUploaded ? ' uploaded' : ''}${isUploading ? ' uploading' : ''}`}
            >
              <div className="req-num">{r.num}</div>
              <div className="req-upload-info">
                <div className="req-upload-name">{r.nombre}</div>
                <div className="req-upload-art">{r.art}</div>
                <div className="req-upload-desc">{r.desc}</div>
              </div>
              <div className="req-upload-action">
                {isUploading ? (
                  <div className="uploading-tag">
                    <div className="uploading-spinner" aria-hidden="true" />
                    Extrayendo texto...
                  </div>
                ) : isUploaded ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <div className="upload-file-tag">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                      {doc.name}
                    </div>
                    <div style={{ fontSize: 10, color: doc.extractedFully ? 'var(--green)' : 'var(--yellow)', fontFamily: 'JetBrains Mono, monospace' }}>
                      {doc.extractedFully
                        ? `${(doc.wordCount ?? 0).toLocaleString('es-CL')} palabras · ${doc.extractMethod}`
                        : `⚠ ${doc.extractMethod}`}
                    </div>
                    {canEdit && (
                      <button className="btn-upload-req" style={{ fontSize: 10, padding: '3px 10px' }}
                        onClick={() => triggerUpload(r.id)}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                          <path d="M21 3v5h-5"/>
                          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                          <path d="M8 16H3v5"/>
                        </svg>
                        Reemplazar
                      </button>
                    )}
                  </div>
                ) : canEdit ? (
                  <button className="btn-upload-req" onClick={() => triggerUpload(r.id)}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/>
                      <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    Subir archivo
                  </button>
                ) : (
                  <div className="role-lock-tag" title="Solo el administrador puede subir documentos">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="11" width="18" height="11" rx="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    Sin acceso
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* CTA */}
      <div className="upload-cta">
        <div className="upload-cta-text">
          <h3>
            {count === 0
              ? 'Suba al menos 1 documento para comenzar'
              : count < 5
                ? `${count} documento${count > 1 ? 's' : ''} cargado${count > 1 ? 's' : ''} — puede analizar ahora o subir más`
                : `${count} documentos cargados — listo para el análisis`}
          </h3>
          <p>
            {count === 0
              ? 'El sistema lee el contenido real del documento y lo contrasta con la ley'
              : count < 5
                ? 'Mientras más documentos suba, más completo será el diagnóstico'
                : 'Cobertura excelente. Ejecute el análisis para ver su diagnóstico.'}
          </p>
        </div>
        {canEdit ? (
          <button
            className="btn-analyze"
            data-tour="analyze-btn"
            disabled={count === 0}
            onClick={onStartAnalysis}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
              <line x1="11" y1="8" x2="11" y2="14"/>
              <line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
            Analizar ahora
          </button>
        ) : (
          <div className="role-lock-btn" data-tour="analyze-btn" title={`El rol "${role}" no puede ejecutar el análisis`}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            Solo administrador puede analizar
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        aria-label="Seleccionar documento para subir"
        style={{ display: 'none' }}
        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
        onChange={handleFileSelected}
      />
    </div>
  );
}
