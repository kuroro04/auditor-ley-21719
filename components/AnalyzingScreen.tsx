'use client';
import { useEffect, useState } from 'react';

interface AnalyzingScreenProps {
  docCount: number;
  onFinish: () => void;
}

const STEPS = [
  'Leyendo documentos subidos...',
  'Identificando tipos de documentos...',
  'Verificando criterios legales...',
  'Detectando brechas...',
  'Generando diagnóstico...',
];

type StepState = 'pending' | 'active' | 'done';

export default function AnalyzingScreen({ docCount, onFinish }: AnalyzingScreenProps) {
  const [stepStates, setStepStates] = useState<StepState[]>(STEPS.map(() => 'pending'));
  const [progress, setProgress] = useState(0);
  const [currentLabel, setCurrentLabel] = useState('Iniciando...');

  useEffect(() => {
    let idx = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const advance = () => {
      setStepStates(prev => {
        const next = [...prev];
        if (idx > 0) next[idx - 1] = 'done';
        if (idx < STEPS.length) next[idx] = 'active';
        return next;
      });
      if (idx < STEPS.length) {
        setCurrentLabel(STEPS[idx]);
        setProgress((idx + 1) * 20);
      }
      idx++;
      if (idx <= STEPS.length) {
        timers.push(setTimeout(advance, 700 + Math.random() * 400));
      } else {
        setProgress(100);
        timers.push(setTimeout(onFinish, 500));
      }
    };

    timers.push(setTimeout(advance, 100));
    return () => timers.forEach(clearTimeout);
  }, [onFinish]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="analyzing-wrap">
        <div className="analyzing-icon">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
            <line x1="11" y1="8" x2="11" y2="14"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
        </div>
        <div className="analyzing-title">Analizando su documentación</div>
        <div className="analyzing-sub">
          Estamos contrastando sus documentos contra los{' '}
          <strong>10 requisitos obligatorios</strong> de la Ley 21.719 de Protección de Datos Personales.
        </div>
        <div className="analyzing-filename">
          Analizando {docCount} documento{docCount !== 1 ? 's' : ''}...
        </div>

        <div className="analyzing-steps">
          {STEPS.map((text, i) => {
            const s = stepStates[i];
            return (
              <div key={i} className={`a-step ${s === 'active' ? 'active' : s === 'done' ? 'done' : ''}`}>
                <div className="a-step-num">{s === 'done' ? '✓' : i + 1}</div>
                <div className="a-step-text">{text}</div>
                <div className="a-step-status">
                  {s === 'active' ? 'Procesando...' : s === 'done' ? '✓ Listo' : '—'}
                </div>
              </div>
            );
          })}
        </div>

        <div className="analyzing-bar-wrap">
          <div className="a-bar-label">
            <span>{currentLabel}</span>
            <span>{progress}%</span>
          </div>
          <div className="a-bar">
            <div className="a-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
