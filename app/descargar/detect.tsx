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
  if (os === 'ios') return <p className="dl-detect">Para iPhone usa Órbita desde el navegador; la app llegará más adelante.</p>;
  if (!f) return null;
  return <a className="dl-btn big" href={f.href} download>Descargar para {f.name}</a>;
}
