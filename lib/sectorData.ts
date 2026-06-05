import type { Sector } from './types';

export interface SectorBenchmark {
  label: string;
  promedio: number;       // porcentaje 0-100
  descripcion: string;
}

// Datos simulados realistas del mercado chileno post Ley 21.719
export const SECTOR_DATA: Record<Sector, SectorBenchmark> = {
  retail:     { label: 'Retail / Comercio',  promedio: 58, descripcion: 'Supermercados, tiendas y comercio electrónico' },
  salud:      { label: 'Salud',              promedio: 72, descripcion: 'Clínicas, farmacias y prestadores de salud' },
  finanzas:   { label: 'Finanzas',           promedio: 81, descripcion: 'Bancos, corredoras y compañías de seguros' },
  tecnologia: { label: 'Tecnología',         promedio: 65, descripcion: 'Software, SaaS y telecomunicaciones' },
  otro:       { label: 'Sector General',     promedio: 60, descripcion: 'Promedio general de empresas chilenas' },
};

export const SECTORES_OPCIONES: { value: Sector; label: string; desc: string }[] = [
  { value: 'retail',     label: 'Retail / Comercio',    desc: 'Tiendas, supermercados, e-commerce' },
  { value: 'salud',      label: 'Salud',                desc: 'Clínicas, farmacias, isapres' },
  { value: 'finanzas',   label: 'Finanzas',             desc: 'Bancos, seguros, AFP' },
  { value: 'tecnologia', label: 'Tecnología',           desc: 'Software, SaaS, telecomunicaciones' },
  { value: 'otro',       label: 'Otro sector',          desc: 'Industria, servicios, educación...' },
];
