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
  // Si ya vio (o cerró) el tour de bienvenida alguna vez. Vive en el backend
  // (no en localStorage) para que la preferencia persista entre sesiones y
  // dispositivos.
  onboardingCompleted: boolean;
  // Fase 5 — si este usuario tiene el segundo factor (TOTP) activo.
  mfaEnabled: boolean;
}

interface SessionResponseDto {
  email: string;
  role: UserRole;
  company_id: string;
  company_nombre: string;
  company_sector: string | null;
  onboarding_completed: boolean;
  mfa_enabled?: boolean;
}

function fromDto(dto: SessionResponseDto): SessionInfo {
  return {
    email: dto.email,
    role: dto.role,
    companyId: dto.company_id,
    companyNombre: dto.company_nombre,
    companySector: (dto.company_sector as Sector | null) ?? null,
    onboardingCompleted: dto.onboarding_completed,
    mfaEnabled: dto.mfa_enabled ?? false,
  };
}

// Fase 5 — el login puede terminar en sesión (sin MFA) o en un desafío que
// exige el código TOTP como segundo paso.
export type LoginResult =
  | { mfaRequired: false; session: SessionInfo }
  | { mfaRequired: true; mfaToken: string };

interface MfaChallengeDto {
  mfa_required: true;
  mfa_token: string;
}

export interface MfaSetupInfo {
  otpauthUri: string;
  secretBase32: string;
  qrSvg: string;
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

export async function loginUser(email: string, password: string): Promise<LoginResult> {
  const dto = await apiRequest<SessionResponseDto | MfaChallengeDto>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  if ('mfa_required' in dto && dto.mfa_required) {
    return { mfaRequired: true, mfaToken: dto.mfa_token };
  }
  return { mfaRequired: false, session: fromDto(dto as SessionResponseDto) };
}

// Segundo paso del login con MFA: canjea el token corto + código de 6 dígitos
// (o un código de respaldo) por la cookie de sesión.
export async function loginWithMfa(mfaToken: string, code: string): Promise<SessionInfo> {
  const dto = await apiRequest<SessionResponseDto>('/auth/login/mfa', {
    method: 'POST',
    body: { mfa_token: mfaToken, code },
  });
  return fromDto(dto);
}

// Enrola un segundo factor: devuelve los datos para pintar el QR. Todavía no
// queda activo hasta confirmar con mfaActivate.
export async function mfaSetup(): Promise<MfaSetupInfo> {
  const dto = await apiRequest<{ otpauth_uri: string; secret_base32: string; qr_svg: string }>(
    '/auth/mfa/setup',
    { method: 'POST' },
  );
  return { otpauthUri: dto.otpauth_uri, secretBase32: dto.secret_base32, qrSvg: dto.qr_svg };
}

// Confirma el enrolamiento con el primer código. Devuelve los códigos de
// respaldo de un solo uso (se muestran una única vez).
export async function mfaActivate(code: string): Promise<string[]> {
  const dto = await apiRequest<{ backup_codes: string[] }>('/auth/mfa/activate', {
    method: 'POST',
    body: { code },
  });
  return dto.backup_codes;
}

// Desactiva el segundo factor. Se confirma con la contraseña actual o con un
// código válido (TOTP o de respaldo).
export async function mfaDisable(confirm: { password?: string; code?: string }): Promise<void> {
  await apiRequest<void>('/auth/mfa/disable', { method: 'POST', body: confirm });
}

export async function fetchMe(): Promise<SessionInfo> {
  const dto = await apiRequest<SessionResponseDto>('/auth/me');
  return fromDto(dto);
}

export async function logoutUser(): Promise<void> {
  await apiRequest<void>('/auth/logout', { method: 'POST' });
}

// Avisa al backend que el usuario ya vio (o cerró) el tour de bienvenida,
// para que no vuelva a mostrarse automáticamente en futuros inicios de sesión.
export async function completeOnboarding(): Promise<void> {
  await apiRequest<void>('/auth/complete-onboarding', { method: 'POST' });
}
