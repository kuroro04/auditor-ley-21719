import { apiRequest } from './client';
import type { Sector, UserRole } from '@/lib/types';

export interface RegisterPayload {
  rut: string;
  nombreEmpresa: string;
  email: string;
  password: string;
  sector: Sector;
}

export interface SessionInfo {
  email: string;
  role: UserRole;
  companyId: string;
  companyNombre: string;
  companySector: Sector | null;
}

interface SessionResponseDto {
  email: string;
  role: UserRole;
  company_id: string;
  company_nombre: string;
  company_sector: string | null;
}

function fromDto(dto: SessionResponseDto): SessionInfo {
  return {
    email: dto.email,
    role: dto.role,
    companyId: dto.company_id,
    companyNombre: dto.company_nombre,
    companySector: (dto.company_sector as Sector | null) ?? null,
  };
}

export async function registerCompany(payload: RegisterPayload): Promise<SessionInfo> {
  const dto = await apiRequest<SessionResponseDto>('/auth/register', {
    method: 'POST',
    body: {
      rut: payload.rut,
      nombre_empresa: payload.nombreEmpresa,
      email: payload.email,
      password: payload.password,
      sector: payload.sector,
    },
  });
  return fromDto(dto);
}

export async function loginUser(email: string, password: string): Promise<SessionInfo> {
  const dto = await apiRequest<SessionResponseDto>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  return fromDto(dto);
}

export async function fetchMe(): Promise<SessionInfo> {
  const dto = await apiRequest<SessionResponseDto>('/auth/me');
  return fromDto(dto);
}

export async function logoutUser(): Promise<void> {
  await apiRequest<void>('/auth/logout', { method: 'POST' });
}
