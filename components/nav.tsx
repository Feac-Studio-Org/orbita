'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icon, type IconName } from './icons';

type NavProject = { key: string; name: string; color: string };
type NavSpace = { id: string; name: string; kind: string; roleLabel: string; isOwner: boolean; portfolio: boolean; members: boolean; projects: NavProject[] };
type Props = {
  name: string; initial: string; spaces: NavSpace[];
  modules: { messages: boolean; finance: boolean; assistant: boolean; calendar: boolean; bases: boolean };
  unread: number;
};

export function Sidebar({ name, initial, spaces, modules, unread }: Props) {
  const path = usePathname();
  const search = useSearchParams();
  const [open, setOpen] = useState(false);
  const [closed, setClosed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try { setClosed(JSON.parse(localStorage.getItem('orbita-nav') || '{}')); } catch {}
  }, []);
  useEffect(() => setOpen(false), [path, search]);
  useEffect(() => {
    const btn = document.getElementById('menuBtn');
    const toggle = () => setOpen((o) => !o);
    btn?.addEventListener('click', toggle);
    return () => btn?.removeEventListener('click', toggle);
  }, []);

  function toggleSpace(id: string, isOpen: boolean) {
    const next = { ...closed, [id]: !isOpen };
    setClosed(next);
    try { localStorage.setItem('orbita-nav', JSON.stringify(next)); } catch {}
  }
  const allClosed = spaces.every((s) => closed[s.id]);
  function toggleAll() {
    const next: Record<string, boolean> = {};
    spaces.forEach((s) => (next[s.id] = !allClosed));
    setClosed(next);
    try { localStorage.setItem('orbita-nav', JSON.stringify(next)); } catch {}
  }

  const item = (href: string, label: string, ico: IconName | { color: string }, extra?: React.ReactNode, active?: boolean) => {
    const on = active ?? (href === '/' ? path === '/' : path === href || path.startsWith(href + '/'));
    return (
      <Link key={href + label} href={href} className="nav-item" aria-current={on ? 'page' : undefined}>
        {typeof ico === 'string' ? <Icon name={ico} /> : <span className="dot" style={{ background: ico.color }} />}
        <span className="nl">{label}</span>
        {extra}
      </Link>
    );
  };

  return (
    <aside className={'side' + (open ? ' open' : '')} id="side" aria-label="Navegación">
      <Link href="/" className="brand"><img src="/logo.webp" alt="" /><b>Órbita</b></Link>
      <Link href="/perfil" className="me">
        <span className="avatar">{initial}</span>
        <div style={{ minWidth: 0 }}><b>{name}</b><span>{spaces.length} espacios · ver perfil</span></div>
      </Link>
      <nav className="navgroup">
        {item('/', 'Inicio', 'home')}
        {item('/notificaciones', 'Notificaciones', 'bell', unread ? <span className="count">{unread}</span> : null)}
        {modules.calendar && item('/calendario', 'Calendario', 'cal')}
        {modules.messages && item('/mensajes', 'Mensajes', 'msg')}
        {modules.finance && item('/finanzas', 'Finanzas', 'money')}
      </nav>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 8px' }}>
        <span className="label">Espacios</span>
        <button className="link" style={{ fontSize: 11.5 }} onClick={toggleAll}>{allClosed ? 'Expandir todo' : 'Contraer todo'}</button>
      </div>
      {spaces.map((s) => {
        const isOpen = !closed[s.id];
        return (
          <details key={s.id} className="space navgroup" open={isOpen} onToggle={(e) => { const o = (e.currentTarget as HTMLDetailsElement).open; if (o !== isOpen) toggleSpace(s.id, o); }}>
            <summary>
              <Icon name="chev" size={12} className="" />
              <span className="label" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
              <span className="role">{s.roleLabel}</span>
            </summary>
            {s.kind === 'personal' && (
              <>
                {item('/personal', 'Mi espacio', { color: '#9a92a8' })}
                {modules.bases && item('/personal/bases', 'Mis bases de datos', { color: '#5fc9c0' })}
              </>
            )}
            {s.portfolio && item(`/portafolio/${s.id}`, 'Portafolio', 'chart')}
            {s.projects.map((p) => item(`/p/${p.key}`, p.name, { color: p.color }, <span className="key">{p.key}</span>))}
            {s.kind === 'team' && s.members && item(`/miembros/${s.id}`, 'Miembros y roles', 'people')}
            {s.isOwner && item(`/nuevo/proyecto?espacio=${s.id}`, 'Nuevo proyecto', 'plus', null, false)}
          </details>
        );
      })}
      <nav className="navgroup" style={{ marginTop: 'auto' }}>
        {item('/nuevo/espacio', 'Crear un espacio', 'plus')}
        {modules.assistant && item('/asistente', 'Asistente', 'plug', <span className="key">MCP</span>)}
        {item('/ajustes', 'Ajustes', 'gear')}
      </nav>
    </aside>
  );
}
