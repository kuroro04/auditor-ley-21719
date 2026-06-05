'use client';
import { useState, useCallback } from 'react';
import type { ToastItem } from '@/lib/types';

let nextId = 0;

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((msg: string, type: ToastItem['type'] = 'blue') => {
    const id = nextId++;
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  return { toasts, toast };
}
