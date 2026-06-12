'use client';
import type { HistorialSnapshot } from '@/lib/types';

interface HistorialViewProps {
  snapshots: HistorialSnapshot[];
}

// Dimensiones del área de trazado SVG
const W = 600, H = 190;
const PAD = { top: 20, right: 24, bottom: 48, left: 48 };
const CW = W - PAD.left - PAD.right; // ancho útil: 528
const CH = H - PAD.top - PAD.bottom; // alto útil: 122

function xPos(i: number, total: number): number {
  return total === 1 ? PAD.left + CW / 2 : PAD.left + (i / (total - 1)) * CW;
}
function yPos(pct: number): number {
  return PAD.top + (1 - pct / 100) * CH;
}
function fechaCorta(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
}

export default function HistorialView({ snapshots }: HistorialViewProps) {
  // Estado vacío: nunca se ejecutó ningún análisis
  if (snapshots.length === 0) {
    return (
      <div className="historial-view">
        <div className="historial-empty">
          <div className="historial-empty-icon">📈</div>
          <h3>Aún no hay análisis registrados</h3>
          <p>
            Suba sus documentos en la pestaña <strong>Subir documentos</strong> y ejecute
            el análisis para comenzar a registrar la evolución del cumplimiento de su empresa.
          </p>
        </div>
      </div>
    );
  }

  const ultimo    = snapshots[snapshots.length - 1];
  const penultimo = snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null;
  const delta     = penultimo ? ultimo.pct - penultimo.pct : 0;

  // Construir la polilínea SVG (solo cuando hay ≥2 puntos)
  const polylinePoints = snapshots
    .map((s, i) => `${xPos(i, snapshots.length).toFixed(1)},${yPos(s.pct).toFixed(1)}`)
    .join(' ');

  // Polígono de área rellena: línea + cierre inferior
  const areaPoints = snapshots.length > 1
    ? `${polylinePoints} ${xPos(snapshots.length - 1, snapshots.length).toFixed(1)},${(PAD.top + CH).toFixed(1)} ${PAD.left.toFixed(1)},${(PAD.top + CH).toFixed(1)}`
    : '';

  const gridLines = [100, 75, 50, 25, 0];

  return (
    <div className="historial-view">

      {/* Encabezado */}
      <div className="historial-header">
        <h2>Progreso histórico de cumplimiento</h2>
        <p>{snapshots.length} análisis registrado{snapshots.length !== 1 ? 's' : ''} en esta sesión</p>
      </div>

      {/* Indicador de tendencia (solo cuando hay ≥2 análisis) */}
      {penultimo && (
        <div className={`historial-tendencia ${delta > 0 ? 'positiva' : delta < 0 ? 'negativa' : 'neutra'}`}>
          <span className="historial-tendencia-icono">
            {delta > 0 ? '↑' : delta < 0 ? '↓' : '→'}
          </span>
          <span>
            {delta > 0
              ? `Mejoró ${delta}% desde el último análisis (${penultimo.pct}% → ${ultimo.pct}%)`
              : delta < 0
              ? `Retrocedió ${Math.abs(delta)}% desde el último análisis (${penultimo.pct}% → ${ultimo.pct}%)`
              : `Sin cambios respecto al último análisis (${ultimo.pct}%)`}
          </span>
        </div>
      )}

      {/* Gráfico SVG */}
      <div className="historial-chart-wrap">
        {snapshots.length === 1 && (
          <p className="historial-single-msg">
            Ejecute más análisis para ver la evolución de su cumplimiento a lo largo del tiempo.
          </p>
        )}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          className="historial-svg"
        >
          {/* Líneas de cuadrícula y etiquetas eje Y */}
          {gridLines.map(pct => {
            const y = yPos(pct);
            return (
              <g key={pct}>
                <line
                  x1={PAD.left} y1={y}
                  x2={PAD.left + CW} y2={y}
                  stroke="rgba(15,30,61,0.08)" strokeWidth="1"
                />
                <text
                  x={PAD.left - 6} y={y + 4}
                  textAnchor="end" fontSize="10"
                  fill="rgba(138,150,184,1)"
                >
                  {pct}%
                </text>
              </g>
            );
          })}

          {/* Área rellena bajo la línea (≥2 puntos) */}
          {snapshots.length > 1 && (
            <polygon points={areaPoints} fill="rgba(37,99,235,0.07)" />
          )}

          {/* Línea de tendencia (≥2 puntos) */}
          {snapshots.length > 1 && (
            <polyline
              points={polylinePoints}
              fill="none"
              stroke="#2563eb"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Puntos y etiquetas eje X */}
          {snapshots.map((s, i) => {
            const cx = xPos(i, snapshots.length);
            const cy = yPos(s.pct);
            const isLast = i === snapshots.length - 1;
            return (
              <g key={i}>
                <circle cx={cx} cy={cy} r={isLast ? 6 : 5} fill="#2563eb" />
                <circle cx={cx} cy={cy} r={isLast ? 3.5 : 3} fill="white" />
                {/* Etiqueta del porcentaje sobre el punto */}
                <text
                  x={cx} y={cy - 10}
                  textAnchor="middle" fontSize="10" fontWeight={isLast ? '700' : '400'}
                  fill="#2563eb"
                >
                  {s.pct}%
                </text>
                {/* Etiqueta eje X */}
                <text
                  x={cx} y={PAD.top + CH + 18}
                  textAnchor="middle" fontSize="9"
                  fill="rgba(138,150,184,1)"
                >
                  {snapshots.length <= 6 ? fechaCorta(s.fecha) : `#${i + 1}`}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Tabla resumen */}
      <div className="historial-tabla-wrap">
        <table className="historial-tabla">
          <thead>
            <tr>
              <th>#</th>
              <th>Fecha</th>
              <th>Cumplimiento</th>
              <th>Al día</th>
              <th>Incompleto</th>
              <th>Faltante</th>
            </tr>
          </thead>
          <tbody>
            {snapshots.map((s, i) => (
              <tr key={i} className={i === snapshots.length - 1 ? 'historial-row-last' : ''}>
                <td style={{ color: 'var(--text3)' }}>{i + 1}</td>
                <td>{fechaCorta(s.fecha)}</td>
                <td><strong>{s.pct}%</strong></td>
                <td style={{ color: 'var(--green)' }}>{s.green}</td>
                <td style={{ color: 'var(--yellow)' }}>{s.yellow}</td>
                <td style={{ color: 'var(--red)' }}>{s.red}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}
