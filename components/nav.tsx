'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icon, type IconName } from './icons';

type NavProject = { key: string; name: string; color: string; logo?: string | null };
type NavSpace = { id: string; name: string; kind: string; roleLabel: string; isOwner: boolean; portfolio: boolean; members: boolean; projects: NavProject[] };
type Props = {
  name: string; initial: string; avatarUrl?: string | null; spaces: NavSpace[];
  modules: { tasks: boolean; habits: boolean; projects: boolean; notes: boolean; goals: boolean; review: boolean; messages: boolean; finance: boolean; assistant: boolean; calendar: boolean; bases: boolean };
  counts: { tasks: number };
  unread: number;
};

export function Sidebar({ name, initial, avatarUrl, spaces, modules, unread, counts }: Props) {
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
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    btn?.addEventListener('click', toggle);
    window.addEventListener('keydown', esc);
    return () => { btn?.removeEventListener('click', toggle); window.removeEventListener('keydown', esc); };
  }, []);
  useEffect(() => { document.getElementById('menuBtn')?.setAttribute('aria-expanded', String(open)); }, [open]);

  function toggleSpace(id: string, isOpen: boolean) {
    const next = { ...closed, [id]: !isOpen };
    setClosed(next);
    try { localStorage.setItem('orbita-nav', JSON.stringify(next)); } catch {}
  }
  // El espacio personal solo aparece si tiene algo que mostrar (bases o proyectos); los de equipo, si usas proyectos o ya estás en uno.
  const shown = spaces.filter((s) => s.kind === 'personal' ? modules.bases || (modules.projects && s.projects.length > 0) : s.kind === 'habits' ? modules.habits : modules.projects || s.projects.length > 0);
  const allClosed = shown.every((s) => closed[s.id]);
  function toggleAll() {
    const next: Record<string, boolean> = {};
    shown.forEach((s) => (next[s.id] = !allClosed));
    setClosed(next);
    try { localStorage.setItem('orbita-nav', JSON.stringify(next)); } catch {}
  }

  const item = (href: string, label: string, ico: IconName | { color: string; logo?: string | null }, extra?: React.ReactNode, active?: boolean) => {
    const on = active ?? (href === '/' ? path === '/' : path === href || path.startsWith(href + '/'));
    return (
      <Link key={href + label} href={href} className="nav-item" aria-current={on ? 'page' : undefined}>
        {typeof ico === 'string' ? <Icon name={ico} /> : ico.logo ? <img className="nav-logo" src={ico.logo} alt="" /> : <span className="dot" style={{ background: ico.color }} />}
        <span className="nl">{label}</span>
        {extra}
      </Link>
    );
  };

  return (
    <>
    <div className={'side-scrim' + (open ? ' open' : '')} onClick={() => setOpen(false)} aria-hidden="true" />
    {/* Tocar cualquier enlace cierra el menú, también el de la sección donde ya estás. */}
    <aside className={'side' + (open ? ' open' : '')} id="side" aria-label="Navegación" onClick={(e) => { if ((e.target as HTMLElement).closest('a')) setOpen(false); }}>
      <Link href="/" className="brand"><img src="/logo.png" alt="" /><b>Órbita</b></Link>
      <Link href="/perfil" className="me">
        {avatarUrl ? <img src={avatarUrl} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flex: 'none' }} /> : <span className="avatar">{initial}</span>}
        <div style={{ minWidth: 0 }}><b>{name}</b><span>Ver perfil</span></div>
      </Link>
      <nav className="navgroup">
        {item('/', 'Inicio', 'home')}
        {item('/notificaciones', 'Notificaciones', 'bell', unread ? <span className="count">{unread}</span> : null)}
        {modules.tasks && item('/tareas', 'Tareas', 'check', counts.tasks ? <span className="count">{counts.tasks}</span> : null)}
        {modules.habits && item('/habitos', 'Hábitos', 'flame', null, path === '/habitos')}
        {modules.goals && item('/metas', 'Metas', 'flag')}
        {modules.calendar && item('/calendario', 'Calendario', 'cal')}
        {modules.notes && item('/notas', 'Notas', 'note')}
        {modules.review && item('/revision', 'Revisión', 'chart')}
        {modules.messages && item('/mensajes', 'Mensajes', 'msg')}
        {modules.finance && item('/finanzas', 'Finanzas', 'money')}
      </nav>
      {shown.length > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 8px' }}>
        <span className="label">Espacios</span>
        <button className="link" style={{ fontSize: 11.5 }} onClick={toggleAll}>{allClosed ? 'Expandir todo' : 'Contraer todo'}</button>
      </div>}
      {shown.map((s) => {
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
                {modules.bases && item('/personal/bases', 'Mis bases de datos', 'grid')}
              </>
            )}
            {s.kind === 'habits' && (
              <>
                {item(`/habitos/${s.id}`, 'Hoy', 'home')}
                {item(`/habitos/${s.id}?zona=semana`, 'Mi semana', 'cal')}
                {item(`/habitos/${s.id}?zona=habitos`, 'Mis hábitos', 'grid')}
                {item(`/habitos/${s.id}?zona=track`, 'Track del grupo', 'people')}
              </>
            )}
            {s.portfolio && item(`/portafolio/${s.id}`, 'Portafolio', 'chart')}
            {s.projects.map((p) => item(`/p/${p.key}`, p.name, { color: p.color, logo: p.logo }, <span className="key">{p.key}</span>))}
            {s.kind === 'team' && s.members && item(`/miembros/${s.id}`, 'Miembros y roles', 'people')}
            {s.isOwner && s.kind !== 'habits' && modules.projects && item(`/nuevo/proyecto?espacio=${s.id}`, 'Nuevo proyecto', 'plus', null, false)}
          </details>
        );
      })}
      <nav className="navgroup" style={{ marginTop: 'auto' }}>
        {(modules.projects || modules.habits) && item('/nuevo/espacio', modules.projects ? 'Crear un espacio' : 'Crear grupo de hábitos', 'plus')}
        {modules.assistant && item('/asistente', 'Asistente', 'plug', <span className="key">MCP</span>)}
        {item('/ajustes', 'Ajustes', 'gear')}
        <form action="/auth/salir" method="post" className="side-out"><button className="nav-item" type="submit" style={{ width: '100%' }}><Icon name="out" /><span className="nl">Cerrar sesión</span></button></form>
      </nav>
    </aside>
    </>
  );
}

const TITULOS: [string, string][] = [
  ['/tareas', 'Tareas'], ['/habitos', 'Hábitos'], ['/proyectos', 'Proyectos'], ['/metas', 'Metas'], ['/calendario', 'Calendario'], ['/notas', 'Notas'],
  ['/revision', 'Revisión'], ['/mensajes', 'Mensajes'], ['/finanzas', 'Finanzas'], ['/notificaciones', 'Notificaciones'], ['/ajustes', 'Ajustes'],
  ['/perfil', 'Perfil'], ['/asistente', 'Asistente'], ['/buscar', 'Buscar'], ['/personal', 'Bases de datos'], ['/portafolio', 'Portafolio'], ['/miembros', 'Miembros'], ['/p/', 'Proyecto'], ['/t/', 'Tarea'],
];

/** Título del encabezado en el celular, como en la app. */
export function TopTitle() {
  const path = usePathname();
  const t = path === '/' ? 'Hoy' : TITULOS.find(([p]) => path.startsWith(p))?.[1] ?? 'Órbita';
  // Si la página repite este título en grande, en el celular se esconde (la app solo lo muestra arriba).
  useEffect(() => {
    const head = document.querySelector('.view-head');
    if (head?.querySelector('h1')?.textContent?.trim() === t) head.setAttribute('data-repetido', '');
  }, [path, t]);
  return <b className="top-title">{t}</b>;
}

type Tab = { href: string; label: string; ico: IconName };

/** Barra inferior del celular: las mismas pestañas de la app, según las herramientas activas. */
export function TabBar({ modules }: { modules: Props['modules'] }) {
  const path = usePathname();
  const posibles: (Tab | false)[] = [
    { href: '/', label: 'Hoy', ico: 'home' },
    modules.tasks && { href: '/tareas', label: 'Tareas', ico: 'check' },
    modules.habits && { href: '/habitos', label: 'Hábitos', ico: 'flame' },
    modules.projects && { href: '/proyectos', label: 'Proyectos', ico: 'layers' },
    modules.messages && { href: '/mensajes', label: 'Mensajes', ico: 'msg' },
  ];
  const tabs = posibles.filter((t): t is Tab => !!t);
  if (tabs.length < 5) tabs.push({ href: '/perfil', label: 'Perfil', ico: 'people' });
  return (
    <nav className="tabbar" aria-label="Secciones">
      {tabs.map((t) => {
        const on = t.href === '/' ? path === '/' : path === t.href || path.startsWith(t.href + '/') || (t.href === '/proyectos' && path.startsWith('/p/'));
        return <Link key={t.href} href={t.href} className="tb-item" aria-current={on ? 'page' : undefined}><span className="tb-ico"><Icon name={t.ico} size={20} className="" /></span>{t.label}</Link>;
      })}
    </nav>
  );
}
