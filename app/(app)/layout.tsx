import { Suspense } from 'react';
import { Sidebar } from '@/components/nav';
import { Icon } from '@/components/icons';
import { getContext } from '@/lib/data';
import { ROLE, initial } from '@/lib/format';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, profile, spaces, modules } = await getContext();
  const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('read_at', null);
  const name = profile?.full_name || user.email || '';
  const navSpaces = spaces.map((s) => ({
    id: s.id, name: s.name, kind: s.kind, roleLabel: s.kind === 'personal' ? 'Solo tú' : ROLE[s.role],
    isOwner: s.role === 'owner', portfolio: !!s.modules.portfolio && s.kind === 'team', members: s.modules.members !== false,
    projects: s.projects.map((p) => ({ key: p.key, name: p.name, color: p.color })),
  }));
  return (
    <div className="app">
      <Suspense>
        <Sidebar name={name} initial={initial(name)} spaces={navSpaces} modules={modules} unread={count ?? 0} />
      </Suspense>
      <div className="main">
        <header className="top">
          <button className="menu-btn" id="menuBtn" aria-label="Abrir navegación"><Icon name="menu" className="" /></button>
          <div className="crumbs" id="crumbs"><b>Órbita</b></div>
          <form action="/auth/salir" method="post"><button className="pill mini" type="submit" title="Cerrar sesión"><Icon name="out" size={14} className="" />Salir</button></form>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
