import { cache } from 'react';
import { requireUser } from './supabase/server';

/** Herramientas que cada persona activa. Tareas, hábitos y proyectos son independientes del tipo de perfil. */
export type Modules = { tasks: boolean; habits: boolean; projects: boolean; notes: boolean; goals: boolean; review: boolean; messages: boolean; finance: boolean; assistant: boolean; calendar: boolean; bases: boolean };
export type Features = { sprints?: boolean; epics?: boolean; docs?: boolean };
export type Space = {
  id: string; name: string; kind: 'personal' | 'team' | 'habits'; description: string;
  modules: { portfolio?: boolean; finance?: boolean; members?: boolean };
  role: 'owner' | 'partner' | 'member' | 'guest';
  projects: Project[];
};
export type Project = {
  id: string; key: string; name: string; description: string; color: string; status_label: string;
  repo: string; repo_url: string; space_id: string; position: number; finance_separate: boolean; logo_url: string | null; features: Features;
};
export type Issue = {
  id: string; key: string; number: number; type: string; title: string; description: string; status: string; priority: string;
  due_date: string | null; epic_id: string | null; sprint_id: string | null; project_id: string; position: number;
};

/** Perfil, espacios y proyectos visibles. Se usa en la barra lateral y en casi todas las páginas. */
export const getContext = cache(async () => {
  const { supabase, user } = await requireUser();
  const [{ data: profile }, { data: members }, { data: projects }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, timezone, modules, preferences, avatar_url').eq('id', user.id).single(),
    supabase.from('space_members').select('role, position, spaces (id, name, kind, description, modules, created_at)').eq('user_id', user.id),
    supabase.from('projects').select('id, key, name, description, color, status_label, repo, repo_url, space_id, position, finance_separate, logo_url, features').is('archived_at', null).order('position'),
  ]);
  const spaces: Space[] = (members ?? [])
    .map((m: any) => ({ ...m.spaces, role: m.role, projects: (projects ?? []).filter((p) => p.space_id === m.spaces.id) }))
    .sort((a: any, b: any) => (a.kind === 'personal' ? -1 : b.kind === 'personal' ? 1 : a.created_at.localeCompare(b.created_at)));
  const modules: Modules = { tasks: true, habits: true, projects: false, notes: true, goals: true, review: true, messages: true, finance: false, assistant: false, calendar: true, bases: false, ...(profile?.modules ?? {}) };
  // Quien ya está en un equipo ve sus proyectos aunque no haya activado la herramienta.
  if (spaces.some((s) => s.kind === 'team')) modules.projects = modules.projects || spaces.some((s) => s.kind === 'team' && s.projects.length > 0);
  return { supabase, user, profile, spaces, projects: (projects ?? []) as Project[], modules };
});

export function spaceOf(spaces: Space[], id: string) {
  return spaces.find((s) => s.id === id);
}
