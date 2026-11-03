'use client';
import { useEffect, useState } from 'react';

/** Botón principal según el sistema de quien visita. */
export function Detect({ files }: { files: { os: string; name: string; href: string }[] }) {
  const [os, setOs] = useState<string | null>(null);
  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    setOs(/android/.test(ua) ? 'android' : /iphone|ipad/.test(ua) ? 'ios' : /mac/.test(ua) ? 'mac' : /win/.test(ua) ? 'windows' : /linux/.test(ua) ? 'linux' : null);
  }, []);
  const f = files.find((x) => x.os === os);
  if (os === 'ios') return (
    <div className="dl-ios">
      <p>En iPhone, Órbita se instala desde Safari y queda con su ícono en la pantalla de inicio:</p>
      <ol>
        <li>Abre esta página en <b>Safari</b>.</li>
        <li>Toca el botón <b>Compartir</b> (el cuadrado con la flecha hacia arriba).</li>
        <li>Elige <b>Agregar a pantalla de inicio</b> y toca <b>Agregar</b>.</li>
      </ol>
      <a className="dl-btn big" href="/login">Abrir Órbita</a>
    </div>
  );
  if (!f) return null;
  return <a className="dl-btn big" href={f.href} download>Descargar para {f.name}</a>;
}
