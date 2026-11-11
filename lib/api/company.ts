// Cliente HTTP para gestión de perfil de empresa, equipo RBAC y sesiones
import { apiRequest } from './client';
import type { CompanyProfile, TeamMember, UserRole } from '../types';

export async function getCompanyProfile(): Promise<CompanyProfile> {
  return apiRequest<CompanyProfile>('/auth/company');
}

export async function updateCompanyProfile(data: { nombre?: string; sector?: string }): Promise<CompanyProfile> {
  return apiRequest<CompanyProfile>('/auth/company', {
    method: 'PUT',
    body: data,
  });
}

export async function listTeamMembers(): Promise<TeamMember[]> {
  return apiRequest<TeamMember[]>('/auth/users');
}

export async function createTeamMember(data: {
  email: string;
  password: string;
  role: UserRole;
}): Promise<TeamMember> {
  return apiRequest<TeamMember>('/auth/users', {
    method: 'POST',
    body: data,
  });
}

export async function updateTeamMemberRole(userId: string, role: UserRole): Promise<TeamMember> {
  return apiRequest<TeamMember>(`/auth/users/${encodeURIComponent(userId)}/role`, {
    method: 'PATCH',
    body: { role },
  });
}

export async function revokeOtherSessions(): Promise<{ ok: boolean; message: string }> {
  return apiRequest<{ ok: boolean; message: string }>('/auth/revoke-sessions', {
    method: 'POST',
  });
}
