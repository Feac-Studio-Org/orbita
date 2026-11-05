import { Suspense } from 'react';
import { Sidebar, TabBar, TopTitle } from '@/components/nav';
import { AvisoSinConexion } from '@/components/pwa';
import { Icon } from '@/components/icons';
import { getContext } from '@/lib/data';
import { ROLE, initial, todayISO } from '@/lib/format';
import { AutoBackup } from '@/components/auto-backup';

export const maxDuration = 300;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, profile, spaces, modules } = await getContext();
  const [{ count }, { data: bk }, { count: tasksDue }] = await Promise.all([
    supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('read_at', null),
    supabase.from('backup_settings').select('auto_weekly, last_run').eq('user_id', user.id).maybeSingle(),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('done_at', null).lte('due_date', todayISO()),
  ]);
  const backupDue = !!bk?.auto_weekly && (!bk.last_run || Date.now() - new Date(bk.last_run).getTime() > 7 * 864e5);
  const name = profile?.full_name || user.email || '';
  const navSpaces = spaces.map((s) => ({
    id: s.id, name: s.name, kind: s.kind, roleLabel: s.kind === 'personal' ? 'Solo tú' : ROLE[s.role],
    isOwner: s.role === 'owner', portfolio: !!s.modules.portfolio && s.kind === 'team', members: s.modules.members !== false,
    projects: s.projects.map((p) => ({ key: p.key, name: p.name, color: p.color, logo: p.logo_url })),
  }));
  return (
    <div className="app">
      {backupDue && <AutoBackup />}
      <Suspense>
        <Sidebar name={name} initial={initial(name)} avatarUrl={profile?.avatar_url} spaces={navSpaces} modules={modules} unread={count ?? 0} counts={{ tasks: tasksDue ?? 0 }} />
      </Suspense>
      <div className="main">
        <header className="top">
          <button className="menu-btn" id="menuBtn" aria-label="Abrir navegación" aria-controls="side" aria-expanded="false"><Icon name="menu" className="" /></button>
          <TopTitle />
          <form action="/buscar" className="search-box" role="search">
            <Icon name="search" size={14} className="" />
            <input name="q" placeholder="Buscar tareas, proyectos y documentos" aria-label="Buscar" />
          </form>
          <div className="top-spacer" style={{ flex: 1 }} />
          <a href="/buscar" className="icon-link search-link" aria-label="Buscar"><Icon name="search" className="" /></a>
          <a href="/notificaciones" className="icon-link" aria-label={`Notificaciones${count ? `: ${count} sin leer` : ''}`}><Icon name="bell" className="" />{!!count && <span className="dot-badge" />}</a>
          <form action="/auth/salir" method="post"><button className="pill mini out-btn" type="submit" title="Cerrar sesión" aria-label="Salir"><Icon name="out" size={14} className="" /><span>Salir</span></button></form>
        </header>
        <AvisoSinConexion />
        <main className="content">{children}</main>
      </div>
      <TabBar modules={modules} />
    </div>
  );
}
