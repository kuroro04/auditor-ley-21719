'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useTheme, ThemePreference } from '../hooks/useTheme';

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme, toggleTheme, mounted } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [menuOpen]);

  // Cerrar con Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && menuOpen) {
        setMenuOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  if (!mounted) {
    // Placeholder durante SSR para evitar salto visual
    return (
      <div
        className="theme-toggle-btn skeleton"
        style={{ width: 34, height: 34, borderRadius: 'var(--radius-sm)' }}
        aria-hidden="true"
      />
    );
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <div className="theme-toggle-container" ref={containerRef}>
      <button
        type="button"
        className="theme-toggle-btn"
        onClick={() => setMenuOpen(!menuOpen)}
        title={`Tema actual: ${theme === 'system' ? 'Automático (Sistema)' : isDark ? 'Modo Oscuro' : 'Modo Claro'}. Clic para cambiar.`}
        aria-label="Cambiar tema de la interfaz"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
      >
        {isDark ? (
          <svg
            className="theme-icon moon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
          </svg>
        ) : (
          <svg
            className="theme-icon sun"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2" />
            <path d="M12 20v2" />
            <path d="m4.93 4.93 1.41 1.41" />
            <path d="m17.66 17.66 1.41 1.41" />
            <path d="M2 12h2" />
            <path d="M20 12h2" />
            <path d="m6.34 17.66-1.41 1.41" />
            <path d="m19.07 4.93-1.41 1.41" />
          </svg>
        )}
      </button>

      {menuOpen && (
        <div className="theme-dropdown-menu" role="menu" aria-label="Opciones de tema">
          <button
            type="button"
            className={`theme-menu-item ${theme === 'light' ? 'active' : ''}`}
            role="menuitem"
            onClick={() => {
              setTheme('light');
              setMenuOpen(false);
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" /><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
            </svg>
            <span>Claro</span>
            {theme === 'light' && <span className="theme-check">✓</span>}
          </button>

          <button
            type="button"
            className={`theme-menu-item ${theme === 'dark' ? 'active' : ''}`}
            role="menuitem"
            onClick={() => {
              setTheme('dark');
              setMenuOpen(false);
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
            </svg>
            <span>Oscuro</span>
            {theme === 'dark' && <span className="theme-check">✓</span>}
          </button>

          <button
            type="button"
            className={`theme-menu-item ${theme === 'system' ? 'active' : ''}`}
            role="menuitem"
            onClick={() => {
              setTheme('system');
              setMenuOpen(false);
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>
            </svg>
            <span>Sistema</span>
            {theme === 'system' && <span className="theme-check">✓</span>}
          </button>
        </div>
      )}
    </div>
  );
}
