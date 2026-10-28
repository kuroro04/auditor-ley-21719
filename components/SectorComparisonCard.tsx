'use client';
import { useEffect, useRef } from 'react';
import { SECTOR_DATA } from '@/lib/sectorData';
import type { Sector } from '@/lib/types';

interface SectorComparisonCardProps {
  sector: Sector;
  companyCumplimiento: number;
}

export default function SectorComparisonCard({ sector, companyCumplimiento }: SectorComparisonCardProps) {
  const benchmark    = SECTOR_DATA[sector];
  const delta        = companyCumplimiento - benchmark.promedio;
  const empresaRef   = useRef<HTMLDivElement>(null);
  const promedioRef  = useRef<HTMLDivElement>(null);

  // Animar barras desde 0 al valor real al montar
  useEffect(() => {
    const t = setTimeout(() => {
      if (empresaRef.current)  empresaRef.current.style.width  = `${companyCumplimiento}%`;
      if (promedioRef.current) promedioRef.current.style.width = `${benchmark.promedio}%`;
    }, 150);
    return () => clearTimeout(t);
  }, [companyCumplimiento, benchmark.promedio]);

  return (
    <div className="sector-card">
      <div className="sector-card-header">
        <h3>Comparación con su sector</h3>
        <span className="sector-badge">{benchmark.label}</span>
      </div>

      <div className="sector-stat">
        <div className="sector-stat-label">Su empresa</div>
        <div className="sector-bar-track">
          <div ref={empresaRef} className="sector-bar empresa" style={{ width: 0 }} />
        </div>
        <span className="sector-bar-pct">{companyCumplimiento}%</span>
      </div>

      <div className="sector-stat">
        <div className="sector-stat-label">Promedio {benchmark.label}</div>
        <div className="sector-bar-track">
          <div ref={promedioRef} className="sector-bar promedio" style={{ width: 0 }} />
        </div>
        <span className="sector-bar-pct">{benchmark.promedio}%</span>
      </div>

      <div className={`sector-delta ${delta >= 0 ? 'positivo' : 'negativo'}`}>
        {delta >= 0 ? '▲' : '▼'}{' '}
        {Math.abs(delta)} puntos porcentuales{' '}
        {delta >= 0 ? 'sobre' : 'bajo'} el promedio del sector
      </div>

      <p className="sector-desc">{benchmark.descripcion}</p>
    </div>
  );
}
