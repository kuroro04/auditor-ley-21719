'use client';
import { useEffect, useState, useCallback } from 'react';

interface TourStep {
  target: string;        // valor de data-tour del elemento
  titulo: string;
  descripcion: string;
  posicionAbajo: boolean; // true = tooltip bajo el elemento, false = encima
}

const PASOS: TourStep[] = [
  {
    target: 'upload-zone',
    titulo: 'Suba sus documentos actuales',
    descripcion: 'Aquí cargue los documentos de su empresa — política de privacidad, registros, contratos. Cada uno corresponde a un requisito de la Ley 21.719.',
    posicionAbajo: true,
  },
  {
    target: 'analyze-btn',
    titulo: 'Presione Analizar',
    descripcion: 'Presione Analizar para revisar su cumplimiento. El sistema lee el contenido real de sus documentos y los contrasta automáticamente con los criterios legales.',
    posicionAbajo: false,
  },
  {
    target: 'tab-diagnostico',
    titulo: 'Revise su diagnóstico',
    descripcion: 'Aquí encontrará su diagnóstico completo: qué requisitos cumple, qué brechas tiene, y un informe PDF para presentar al directorio.',
    posicionAbajo: true,
  },
];

interface SpotlightRect { top: number; left: number; width: number; height: number; }
interface TooltipPos    { top: number; left: number; }

interface OnboardingTourProps {
  tourStep: number;
  onNext: () => void;
  onSkip: () => void;
}

export default function OnboardingTour({ tourStep, onNext, onSkip }: OnboardingTourProps) {
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null);
  const [tooltipPos, setTooltipPos]       = useState<TooltipPos>({ top: 160, left: 200 });
  const paso = PASOS[tourStep];

  const calcularPosicion = useCallback(() => {
    if (!paso) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${paso.target}"]`);
    if (!el) return;

    const rect    = el.getBoundingClientRect();
    const PADDING = 8;
    const TOOLTIP_W = 308;

    setSpotlightRect({
      top:    rect.top    - PADDING,
      left:   rect.left   - PADDING,
      width:  rect.width  + PADDING * 2,
      height: rect.height + PADDING * 2,
    });

    const left = Math.min(
      Math.max(16, rect.left),
      window.innerWidth - TOOLTIP_W - 16
    );

    setTooltipPos(
      paso.posicionAbajo
        ? { top: rect.bottom + PADDING + 14, left }
        : { top: Math.max(16, rect.top - 190), left }
    );
  }, [paso]);

  useEffect(() => {
    calcularPosicion();
    window.addEventListener('resize', calcularPosicion);
    return () => window.removeEventListener('resize', calcularPosicion);
  }, [calcularPosicion]);

  if (!paso) return null;

  return (
    <>
      {/* Spotlight: box-shadow gigante oscurece todo el viewport menos el recorte */}
      {spotlightRect && (
        <div
          className="tour-spotlight"
          style={{
            top:    spotlightRect.top,
            left:   spotlightRect.left,
            width:  spotlightRect.width,
            height: spotlightRect.height,
          }}
        />
      )}

      {/* Tooltip posicionado cerca del elemento */}
      <div className="tour-tooltip" key={tourStep} style={{ top: tooltipPos.top, left: tooltipPos.left }}>
        <div className="tour-step-indicator">Paso {tourStep + 1} de {PASOS.length}</div>
        <div className="tour-titulo">{paso.titulo}</div>
        <p className="tour-desc">{paso.descripcion}</p>
        <div className="tour-actions">
          <button className="tour-btn-skip" onClick={onSkip}>Saltar tour</button>
          <button className="tour-btn-next" onClick={onNext}>
            {tourStep < PASOS.length - 1 ? 'Siguiente →' : 'Empezar →'}
          </button>
        </div>
      </div>
    </>
  );
}
