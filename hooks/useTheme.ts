'use client';

import { useState, useEffect, useCallback } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'datashield_theme';

export function useTheme() {
  const [theme, setThemeState] = useState<ThemePreference>('system');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');
  const [mounted, setMounted] = useState(false);

  // Determinar el tema resuelto según la preferencia y media query del sistema
  const applyTheme = useCallback((pref: ThemePreference) => {
    if (typeof window === 'undefined') return;

    let target: ResolvedTheme = 'light';
    if (pref === 'dark') {
      target = 'dark';
    } else if (pref === 'light') {
      target = 'light';
    } else {
      // system
      target = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    setResolvedTheme(target);
    document.documentElement.setAttribute('data-theme', target);
    document.documentElement.style.colorScheme = target;
  }, []);

  useEffect(() => {
    setMounted(true);
    let saved: ThemePreference = 'system';
    try {
      const val = localStorage.getItem(STORAGE_KEY);
      if (val === 'light' || val === 'dark' || val === 'system') {
        saved = val;
      }
    } catch {
      // Ignorar restricciones de almacenamiento local
    }
    setThemeState(saved);
    applyTheme(saved);

    // Escuchar cambios en la preferencia del sistema operativo
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = () => {
      // Solo actualiza si estamos en modo 'system'
      const current = localStorage.getItem(STORAGE_KEY) as ThemePreference || 'system';
      if (current === 'system') {
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, [applyTheme]);

  const setTheme = useCallback((newTheme: ThemePreference) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch {
      // Ignorar si localStorage está bloqueado
    }
    applyTheme(newTheme);
  }, [applyTheme]);

  // Alternador rápido entre claro y oscuro
  const toggleTheme = useCallback(() => {
    const next: ThemePreference = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(next);
  }, [resolvedTheme, setTheme]);

  return {
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme,
    mounted,
  };
}
