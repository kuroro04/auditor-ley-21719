import type { UserRole } from './types';

// ═══════════════════════════════════════════════════════════════════════════
// SIMULACIÓN DE BACKEND: mapa de usuarios a su rol predefinido.
//
// IMPORTANTE — esto es solo un stand-in para la Fase 1 (todo el estado vive
// en el navegador, no hay servidor todavía). En producción este mapa NO
// existiría en el código fuente: el rol se recuperaría desde la base de
// datos (tabla usuarios) inmediatamente después de que el backend valide
// las credenciales (endpoint de login), nunca antes ni desde el cliente.
// El usuario JAMÁS debe poder elegir su propio rol.
// ═══════════════════════════════════════════════════════════════════════════
const USER_ROLE_MAP: Record<string, UserRole> = {
  'admin@empresa.cl':    'administrador',
  'auditor@empresa.cl':  'auditor',
  'lectura@empresa.cl':  'visualizador',
};

// Rol asignado a cualquier correo que no esté en el mapa: principio de
// menor privilegio. Nunca se asume "administrador" para un usuario
// desconocido.
const DEFAULT_ROLE: UserRole = 'visualizador';

// Busca el rol del usuario autenticado por su correo. En producción esta
// función sería reemplazada por una llamada al backend (p.ej. GET /me)
// que ocurre justo después de validar usuario y contraseña.
export function getRoleForUser(email: string): UserRole {
  const normalizado = email.trim().toLowerCase();
  return USER_ROLE_MAP[normalizado] ?? DEFAULT_ROLE;
}
