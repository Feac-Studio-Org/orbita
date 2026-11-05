'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

const BASICAS = ['/', '/tareas', '/habitos', '/metas', '/notas', '/calendario', '/notificaciones'];
const CADA = 6 * 3600e3;

/** Registra el guardado sin conexión; al salir o al llegar a iniciar sesión, borra lo guardado de esa cuenta. */
export function Pwa() {
  const path = usePathname();
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' && !window.location.search.includes('sw=1')) return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').then(async () => {
      const sw = (await navigator.serviceWorker.ready).active;
      if (path === '/login' || path === '/bienvenida') {
        sw?.postMessage({ tipo: 'borrar' });
        // Sin sesión, este dispositivo deja de recibir los avisos de esa cuenta.
        (await navigator.serviceWorker.ready).pushManager?.getSubscription().then((s) => s?.unsubscribe()).catch(() => {});
        try { localStorage.removeItem('orbita-guardado'); } catch {}
        return;
      }
      if (!navigator.onLine) return;
      // Deja listas las secciones principales aunque no se hayan abierto.
      let ultima = 0;
      try { ultima = Number(localStorage.getItem('orbita-guardado')) || 0; } catch {}
      if (Date.now() - ultima < CADA) return;
      try { localStorage.setItem('orbita-guardado', String(Date.now())); } catch {}
      sw?.postMessage({ tipo: 'guardar', urls: BASICAS });
    }).catch(() => {});
  }, [path]);
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
