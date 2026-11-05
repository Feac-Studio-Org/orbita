'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// Valores públicos de la app web de Firebase: identifican el proyecto, no dan acceso.
const FIREBASE = {
  apiKey: 'AIzaSyDBX3nDVqnfdYKH6UEb20J1c704YtI-lqg',
  authDomain: 'orbita-9effc.firebaseapp.com',
  projectId: 'orbita-9effc',
  storageBucket: 'orbita-9effc.firebasestorage.app',
  messagingSenderId: '268165750127',
  appId: '1:268165750127:web:24e67a09ff85792baf5c9a',
};
const VAPID = 'BADN-ts4CmhxOQgNJv2MIMY4CrFRMPykS9STgFItoHc3iFvDX5QglEGcgI9aGa8KttJoQNReN0tTbLoPB5Opw1g';

type Estado = 'cargando' | 'iphone' | 'nosoporta' | 'listo' | 'activos' | 'bloqueados' | 'error';

/** Activa los avisos del sistema en este navegador. El envío lo hace la misma función de los celulares. */
export function AvisosDispositivo() {
  const [estado, setEstado] = useState<Estado>('cargando');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    const iphone = /iPhone|iPad/.test(navigator.userAgent);
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setEstado(iphone ? 'iphone' : 'nosoporta');
      return;
    }
    if (Notification.permission === 'denied') return setEstado('bloqueados');
    navigator.serviceWorker.ready.then((r) => r.pushManager.getSubscription()).then((s) => setEstado(s ? 'activos' : 'listo')).catch(() => setEstado('listo'));
  }, []);

  async function activar() {
    setOcupado(true);
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== 'granted') return setEstado('bloqueados');
      const [{ initializeApp }, { getMessaging, getToken }] = await Promise.all([import('firebase/app'), import('firebase/messaging')]);
      const token = await getToken(getMessaging(initializeApp(FIREBASE)), { vapidKey: VAPID, serviceWorkerRegistration: await navigator.serviceWorker.ready });
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error('sin sesión');
      const { error } = await supabase.from('push_tokens').upsert({ token, user_id: data.user.id, platform: 'web', app: 'orbita', updated_at: new Date().toISOString() });
      if (error) throw error;
      setEstado('activos');
    } catch {
      setEstado('error');
    } finally {
      setOcupado(false);
    }
  }

  const texto: Record<Estado, string> = {
    cargando: '',
    iphone: 'En iPhone, primero agrega Órbita a la pantalla de inicio desde Safari (Compartir, Agregar a inicio) y ábrela desde ese ícono. Necesita iOS 16.4 o más nuevo.',
    nosoporta: 'Este navegador no permite avisos.',
    listo: 'Recibe tus avisos en este dispositivo aunque Órbita esté cerrada.',
    activos: 'Los avisos están activos en este dispositivo.',
    bloqueados: 'Los avisos están bloqueados. Actívalos en los ajustes del navegador o del celular.',
    error: 'No se pudieron activar. Inténtalo otra vez.',
  };
  if (estado === 'cargando') return null;
  return (
    <section className="panel">
      <div className="panel-head"><h2>Avisos en este dispositivo</h2></div>
      <p className="muted" style={{ fontSize: 13.5 }}>{texto[estado]}</p>
      {(estado === 'listo' || estado === 'error') && <button className="pill mini" type="button" disabled={ocupado} onClick={activar} style={{ alignSelf: 'flex-start' }}>{ocupado ? 'Activando…' : 'Activar avisos'}</button>}
    </section>
  );
}
