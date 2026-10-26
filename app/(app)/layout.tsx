import { Suspense } from 'react';
import { Sidebar } from '@/components/nav';
import { Icon } from '@/components/icons';
import { getContext } from '@/lib/data';
import { ROLE, initial } from '@/lib/format';
import { AutoBackup } from '@/components/auto-backup';

export const maxDuration = 300;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, profile, spaces, modules } = await getContext();
  const [{ count }, { data: bk }] = await Promise.all([
    supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('read_at', null),
    supabase.from('backup_settings').select('auto_weekly, last_run').eq('user_id', user.id).maybeSingle(),
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
        <Sidebar name={name} initial={initial(name)} avatarUrl={profile?.avatar_url} spaces={navSpaces} modules={modules} unread={count ?? 0} />
      </Suspense>
      <div className="main">
        <header className="top">
          <button className="menu-btn" id="menuBtn" aria-label="Abrir navegación"><Icon name="menu" className="" /></button>
          <form action="/buscar" className="search-box" role="search">
            <Icon name="search" size={14} className="" />
            <input name="q" placeholder="Buscar tareas, proyectos y documentos" aria-label="Buscar" />
          </form>
          <div style={{ flex: 1 }} />
          <a href="/notificaciones" className="icon-link" aria-label={`Notificaciones${count ? `: ${count} sin leer` : ''}`}><Icon name="bell" className="" />{!!count && <span className="dot-badge" />}</a>
          <form action="/auth/salir" method="post"><button className="pill mini" type="submit" title="Cerrar sesión"><Icon name="out" size={14} className="" />Salir</button></form>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
