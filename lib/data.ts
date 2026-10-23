import { cache } from 'react';
import { requireUser } from './supabase/server';

export type Modules = { messages: boolean; finance: boolean; assistant: boolean; calendar: boolean; bases: boolean };
export type Space = {
  id: string; name: string; kind: 'personal' | 'team'; description: string;
  modules: { portfolio?: boolean; finance?: boolean; members?: boolean };
  role: 'owner' | 'partner' | 'member' | 'guest';
  projects: Project[];
};
export type Project = {
  id: string; key: string; name: string; description: string; color: string; status_label: string;
  repo: string; repo_url: string; space_id: string; position: number; finance_separate: boolean;
};
export type Issue = {
  id: string; key: string; number: number; type: string; title: string; description: string; status: string; priority: string;
  due_date: string | null; epic_id: string | null; sprint_id: string | null; project_id: string; position: number;
};

/** Perfil, espacios y proyectos visibles. Se usa en la barra lateral y en casi todas las páginas. */
export const getContext = cache(async () => {
  const { supabase, user } = await requireUser();
  const [{ data: profile }, { data: members }, { data: projects }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, timezone, modules, preferences').eq('id', user.id).single(),
    supabase.from('space_members').select('role, position, spaces (id, name, kind, description, modules, created_at)').eq('user_id', user.id),
    supabase.from('projects').select('id, key, name, description, color, status_label, repo, repo_url, space_id, position, finance_separate').is('archived_at', null).order('position'),
  ]);
  const spaces: Space[] = (members ?? [])
    .map((m: any) => ({ ...m.spaces, role: m.role, projects: (projects ?? []).filter((p) => p.space_id === m.spaces.id) }))
    .sort((a: any, b: any) => (a.kind === 'personal' ? -1 : b.kind === 'personal' ? 1 : a.created_at.localeCompare(b.created_at)));
  const modules: Modules = { messages: true, finance: true, assistant: true, calendar: true, bases: true, ...(profile?.modules ?? {}) };
  return { supabase, user, profile, spaces, projects: (projects ?? []) as Project[], modules };
});

export function spaceOf(spaces: Space[], id: string) {
  return spaces.find((s) => s.id === id);
}
