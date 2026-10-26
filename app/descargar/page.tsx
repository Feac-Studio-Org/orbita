import type { Metadata } from 'next';
import Link from 'next/link';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Detect } from './detect';
import './descargar.css';

export const metadata: Metadata = { title: 'Descargar Órbita', description: 'Órbita para Windows, Mac, Linux y Android.' };
export const dynamic = 'force-static';

const FILES = [
  { os: 'windows', name: 'Windows', file: 'Orbita-Windows-Instalador.exe', note: 'Windows 10 y 11 · instalador', help: 'Si aparece "Windows protegió tu PC", toca "Más información" y luego "Ejecutar de todas formas".',
    icon: <path d="M3 5.5 10.5 4.5v7H3Zm8.5-1.2L21 3v8.5h-9.5ZM3 12.5h7.5v7L3 18.5Zm8.5 0H21V21l-9.5-1.3Z" /> },
  { os: 'mac', name: 'Mac', file: 'Orbita-Mac.dmg', note: 'macOS 11 o superior · Apple Silicon e Intel', help: 'Arrastra Órbita a Aplicaciones. La primera vez, clic derecho sobre Órbita y luego "Abrir".',
    icon: <path d="M16.5 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9s-1.9-.9-3.1-.8C6.9 7.4 5.4 8.4 4.6 9.9c-1.7 2.9-.4 7.2 1.2 9.6.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8s1.9.8 3.1.8c1.3 0 2.1-1.2 2.9-2.4.9-1.3 1.3-2.6 1.3-2.7 0 0-2.7-1-2.7-4.2ZM14.2 5.6c.6-.8 1.1-1.9 1-3-1 0-2.1.6-2.8 1.4-.6.7-1.1 1.8-1 2.9 1 .1 2.1-.5 2.8-1.3Z" /> },
  { os: 'linux', name: 'Linux', file: 'Orbita-Linux-x64.tar.gz', note: 'Ubuntu, Debian, Fedora y similares · 64 bits', help: 'Descomprime el archivo y ejecuta instalar.sh: quedará en tu menú de aplicaciones.',
    icon: <><path d="M12 3c-2 0-3 1.8-3 4 0 1.5.4 2.4-.6 3.9C7.2 12.6 6 14.6 6 16.5c0 .7.2 1.3.5 1.8M12 3c2 0 3 1.8 3 4 0 1.5-.4 2.4.6 3.9 1.2 1.7 2.4 3.7 2.4 5.6 0 .7-.2 1.3-.5 1.8" /><path d="M7 19.5c1 .9 2.6 1.5 5 1.5s4-.6 5-1.5M10.5 7.5h.01M13.5 7.5h.01M11 10h2" /></> },
  { os: 'android', name: 'Android', file: 'orbita.apk', note: 'Android 8 o superior · celular', help: 'Ábrelo desde el celular. Si te lo pide, permite instalar apps de esta fuente.',
    icon: <><rect x="6" y="2.5" width="12" height="19" rx="2.5" /><path d="M10.5 18.5h3" /></> },
];

function size(file: string) {
  const p = join(process.cwd(), 'public', 'descargas', file);
  if (!existsSync(p)) return null;
  return (statSync(p).size / 1024 / 1024).toFixed(0) + ' MB';
}

export default function Download() {
  const items = FILES.map((f) => ({ ...f, size: size(f.file) }));
  return (
    <main className="dl">
      <header className="dl-nav"><Link href="/" className="dl-brand"><img src="/logo.png" alt="" /><b>Órbita</b></Link><Link className="dl-btn ghost" href="/login">Entrar en la web</Link></header>
      <section className="dl-hero">
        <span className="dl-eyebrow">Descargas</span>
        <h1>Órbita en todos <em>tus equipos</em></h1>
        <p>La misma cuenta y los mismos datos en el computador, el celular y la web. Todo se sincroniza solo.</p>
        <Detect files={items.filter((i) => i.size).map((i) => ({ os: i.os, name: i.name, href: `/descargas/${i.file}` }))} />
      </section>
      <section className="dl-grid">
        {items.map((i) => (
          <article key={i.os} id={i.os} className="dl-card">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">{i.icon}</svg>
            <h2>{i.name}</h2>
            <p className="dl-note">{i.note}</p>
            {i.size ? <a className="dl-btn" href={`/descargas/${i.file}`} download>Descargar · {i.size}</a> : <span className="dl-soon">Disponible muy pronto</span>}
            <p className="dl-help">{i.help}</p>
          </article>
        ))}
      </section>
      <p className="dl-foot">¿Prefieres no instalar nada? Órbita funciona completa en el navegador: <Link href="/login">entra en la web</Link>.</p>
    </main>
  );
}
