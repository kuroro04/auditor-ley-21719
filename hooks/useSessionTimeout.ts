'use client';
import { useEffect, useRef, useCallback } from 'react';

// Hook de inactividad de sesión.
// onWarn: se llama a los (idleMinutes * 60 - 60) segundos de inactividad.
// onExpire: se llama al cumplirse idleMinutes * 60 segundos de inactividad.
// active: solo corre cuando la sesión está abierta (screen === 'app').
export function useSessionTimeout(
  onWarn: () => void,
  onExpire: () => void,
  active: boolean,
  idleMinutes: number = 2
) {
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expireTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (warnTimer.current) clearTimeout(warnTimer.current);
    if (expireTimer.current) clearTimeout(expireTimer.current);
  }, []);

  const resetTimers = useCallback(() => {
    clearTimers();
    if (!active) return;
    const totalMs = idleMinutes * 60 * 1000;
    const warnMs = totalMs - 60_000; // advertir 60 s antes del cierre
    warnTimer.current = setTimeout(onWarn, warnMs);
    expireTimer.current = setTimeout(onExpire, totalMs);
  }, [active, idleMinutes, onWarn, onExpire, clearTimers]);

  useEffect(() => {
    if (!active) {
      clearTimers();
      return;
    }
    resetTimers();
    const events = ['mousemove', 'keydown', 'click', 'scroll'];
    events.forEach(e => window.addEventListener(e, resetTimers, { passive: true }));
    return () => {
      clearTimers();
      events.forEach(e => window.removeEventListener(e, resetTimers));
    };
  }, [active, resetTimers, clearTimers]);

  return { resetTimers };
}
