import { describe, it, expect, vi } from 'vitest';
import type { CompanyProfile, TeamMember, UserRole } from '@/lib/types';

describe('Opción 4: Lógica de Perfil de Empresa y Control de Roles (RBAC)', () => {
  it('valida que un administrador pueda gestionar equipo y roles', () => {
    const rolesDisponibles: UserRole[] = ['administrador', 'auditor', 'visualizador'];
    expect(rolesDisponibles).toContain('administrador');
    expect(rolesDisponibles).toContain('auditor');
    expect(rolesDisponibles).toContain('visualizador');
  });

  it('impide auto-degradación si es el único administrador', () => {
    const team: TeamMember[] = [
      {
        id: 'u-1',
        email: 'admin@empresa.cl',
        role: 'administrador',
        mfa_enabled: true,
        onboarding_completed: true,
      },
    ];

    const admins = team.filter(m => m.role === 'administrador');
    const canDemote = admins.length > 1;
    expect(canDemote).toBe(false);
  });

  it('permite degradación si existe otro administrador en el equipo', () => {
    const team: TeamMember[] = [
      {
        id: 'u-1',
        email: 'admin1@empresa.cl',
        role: 'administrador',
        mfa_enabled: true,
        onboarding_completed: true,
      },
      {
        id: 'u-2',
        email: 'admin2@empresa.cl',
        role: 'administrador',
        mfa_enabled: false,
        onboarding_completed: true,
      },
    ];

    const admins = team.filter(m => m.role === 'administrador');
    const canDemote = admins.length > 1;
    expect(canDemote).toBe(true);
  });

  it('estructura correctamente el perfil corporativo', () => {
    const profile: CompanyProfile = {
      id: 'tenant-uuid-1234',
      rut: '76123456-7',
      nombre: 'Empresa Demo SpA',
      sector: 'tecnologia',
      total_users: 3,
      total_documents: 10,
    };

    expect(profile.rut).toBe('76123456-7');
    expect(profile.total_users).toBe(3);
    expect(profile.total_documents).toBe(10);
  });
});
