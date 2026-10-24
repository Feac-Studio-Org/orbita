'use client';
import { useEffect } from 'react';
import { autoBackup } from '@/lib/actions';

/** Lanza la copia semanal en segundo plano cuando ya toca. No bloquea la página. */
export function AutoBackup() {
  useEffect(() => {
    try { if (sessionStorage.getItem('orbita-auto-backup')) return; sessionStorage.setItem('orbita-auto-backup', '1'); } catch {}
    autoBackup().catch(() => {});
  }, []);
  return null;
}
