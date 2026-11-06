'use client';
import { useEffect, useState } from 'react';

/** El guardado sin conexión está retirado: da de baja el service worker que haya quedado en este dispositivo. */
export function Pwa() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
    try { localStorage.removeItem('orbita-guardado'); } catch {}
  }, []);
  return null;
}

/** Aviso sin conexión. Mientras no hay internet, los formularios no se envían para no perder lo escrito en silencio. */
export function AvisoSinConexion() {
  const [fuera, setFuera] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);
  useEffect(() => {
    const leer = () => { setFuera(!navigator.onLine); if (navigator.onLine) setBloqueado(false); };
    leer();
    const alEnviar = (e: Event) => {
      if (navigator.onLine) return;
      e.preventDefault();
      e.stopPropagation();
      setBloqueado(true);
    };
    window.addEventListener('online', leer);
    window.addEventListener('offline', leer);
    document.addEventListener('submit', alEnviar, true);
    return () => {
      window.removeEventListener('online', leer);
      window.removeEventListener('offline', leer);
      document.removeEventListener('submit', alEnviar, true);
    };
  }, []);
  if (!fuera) return null;
  return (
    <div className="offline-bar" role="status">
      {bloqueado ? 'Sin conexión: esto no se guardó. Inténtalo cuando vuelva el internet.' : 'Sin conexión. Estás viendo lo último guardado.'}
    </div>
  );
}
