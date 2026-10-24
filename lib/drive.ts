import type { SupabaseClient } from '@supabase/supabase-js';
import { accessToken, DRIVE_SCOPE } from './google';
import { mdToHtml } from './markdown';
import { FIN_STATUS, PERIOD, PRIORITY, STATUS } from './format';

/* Copia de seguridad en Google Drive.
   Carpetas: Órbita / <Espacio> / <Proyecto> / Documentación (un Google Doc por página),
   más una hoja de Tareas y otra de Finanzas por proyecto. Órbita solo ve los archivos que creó (drive.file). */

export type Part = 'docs' | 'tasks' | 'finance';
/** { [projectId]: partes } y { 'space:<id>': ['finance'] } para las finanzas generales del espacio. */
export type Selection = Record<string, Part[]>;

const FILES = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const FOLDER = 'application/vnd.google-apps.folder';
const DOC = 'application/vnd.google-apps.document';
const SHEET = 'application/vnd.google-apps.spreadsheet';

export function hasDrive(scope?: string | null) {
  return !!scope && scope.split(' ').includes(DRIVE_SCOPE);
}

const clean = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '-').trim().slice(0, 120) || 'Sin título';
const csvCell = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const csv = (rows: unknown[][]) => '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\n');

class Drive {
  constructor(private token: string) {}
  private async req(url: string, init: RequestInit = {}) {
    const r = await fetch(url, { ...init, headers: { Authorization: `Bearer ${this.token}`, ...(init.headers ?? {}) }, cache: 'no-store' });
    return r;
  }
  async alive(id: string) {
    const r = await this.req(`${FILES}/${id}?fields=id,trashed`);
    if (!r.ok) return false;
    return !((await r.json()) as { trashed?: boolean }).trashed;
  }
  async folder(name: string, parent?: string) {
    const r = await this.req(FILES + '?fields=id', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, mimeType: FOLDER, parents: parent ? [parent] : undefined }) });
    if (!r.ok) throw new Error('Drive no creó la carpeta ' + name + ': ' + (await r.text()).slice(0, 160));
    return ((await r.json()) as { id: string }).id;
  }
  /** Crea o reemplaza un archivo convertido a Google Docs o Google Sheets. Devuelve su id. */
  async put(o: { id?: string; name: string; parent: string; kind: 'doc' | 'sheet'; content: string }): Promise<string> {
    const boundary = 'orbita' + Math.random().toString(36).slice(2);
    const meta = o.id ? { name: o.name } : { name: o.name, parents: [o.parent], mimeType: o.kind === 'doc' ? DOC : SHEET };
    const media = o.kind === 'doc' ? 'text/html; charset=UTF-8' : 'text/csv; charset=UTF-8';
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: ${media}\r\n\r\n${o.content}\r\n--${boundary}--`;
    const url = o.id ? `${UPLOAD}/${o.id}?uploadType=multipart&fields=id` : `${UPLOAD}?uploadType=multipart&fields=id`;
    const r = await this.req(url, { method: o.id ? 'PATCH' : 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
    if (!r.ok) {
      if (o.id) return this.put({ ...o, id: undefined }); // el archivo ya no existe o no se puede editar: crear otro
      throw new Error('Drive no guardó ' + o.name + ': ' + (await r.text()).slice(0, 160));
    }
    return ((await r.json()) as { id: string }).id;
  }
}

export async function runBackup(supabase: SupabaseClient, userId: string): Promise<{ ok: boolean; message: string }> {
  const fail = async (message: string) => {
    await supabase.from('backup_settings').upsert({ user_id: userId, last_run: new Date().toISOString(), last_result: message, updated_at: new Date().toISOString() });
    return { ok: false, message };
  };
  const [{ data: scope }, { data: refresh }, { data: settings }] = await Promise.all([
    supabase.rpc('google_scope'), supabase.rpc('google_refresh_token'), supabase.from('backup_settings').select('selection').eq('user_id', userId).maybeSingle(),
  ]);
  if (!refresh || !hasDrive(scope as string)) return fail('Google Drive no está conectado.');
  const token = await accessToken(refresh as string);
  if (!token) return fail('Google no aceptó la conexión. Vuelve a conectar Google Drive.');
  const sel = (settings?.selection ?? {}) as Selection;
  const projectIds = Object.keys(sel).filter((k) => !k.startsWith('space:') && sel[k]?.length);
  const spaceFin = Object.keys(sel).filter((k) => k.startsWith('space:') && sel[k]?.includes('finance')).map((k) => k.slice(6));
  if (!projectIds.length && !spaceFin.length) return fail('No elegiste nada para copiar.');

  const drive = new Drive(token);
  const { data: known } = await supabase.from('backup_files').select('item_key, drive_id').eq('user_id', userId);
  const ids = new Map((known ?? []).map((k) => [k.item_key, k.drive_id]));
  const checked = new Set<string>();
  const save = async (key: string, id: string) => {
    ids.set(key, id);
    await supabase.from('backup_files').upsert({ user_id: userId, item_key: key, drive_id: id, updated_at: new Date().toISOString() });
  };
  const folder = async (key: string, name: string, parent?: string) => {
    const cur = ids.get(key);
    if (cur && (checked.has(key) || (await drive.alive(cur)))) { checked.add(key); return cur; }
    const id = await drive.folder(name, parent);
    checked.add(key);
    await save(key, id);
    return id;
  };

  try {
    const { data: projects } = projectIds.length ? await supabase.from('projects').select('id, key, name, space_id').in('id', projectIds) : { data: [] };
    const spaceIds = [...new Set([...(projects ?? []).map((p) => p.space_id), ...spaceFin])];
    const { data: spaces } = await supabase.from('spaces').select('id, name').in('id', spaceIds);
    const root = await folder('folder:root', 'Órbita');
    let docs = 0, sheets = 0;

    for (const sp of spaces ?? []) {
      const spFolder = await folder(`folder:space:${sp.id}`, clean(sp.name), root);
      if (spaceFin.includes(sp.id)) {
        const { data: fin } = await supabase.from('finance_entries').select('concept, amount, currency, period, status, next_charge, occurred_on, note').eq('space_id', sp.id).is('project_id', null).order('created_at');
        const id = await drive.put({ id: ids.get(`sheet:spacefin:${sp.id}`), name: `${clean(sp.name)} · Finanzas del espacio`, parent: spFolder, kind: 'sheet',
          content: csv([['Concepto', 'Valor', 'Moneda', 'Tipo', 'Estado', 'Próximo cobro', 'Fecha', 'Nota'], ...(fin ?? []).map((f) => [f.concept, f.amount, f.currency, PERIOD[f.period], FIN_STATUS[f.status], f.next_charge, f.occurred_on, f.note])]) });
        await save(`sheet:spacefin:${sp.id}`, id); sheets++;
      }
      for (const p of (projects ?? []).filter((x) => x.space_id === sp.id)) {
        const parts = sel[p.id] ?? [];
        const pFolder = await folder(`folder:project:${p.id}`, clean(`${p.name} (${p.key})`), spFolder);
        if (parts.includes('docs')) {
          const dFolder = await folder(`folder:docs:${p.id}`, 'Documentación', pFolder);
          const { data: pages } = await supabase.from('doc_pages').select('id, title, body, updated_at').eq('project_id', p.id).order('position');
          for (const d of pages ?? []) {
            const html = `<html><head><meta charset="utf-8"></head><body><h1>${d.title.replace(/</g, '&lt;')}</h1>${mdToHtml(d.body || '', 0)}<p style="color:#888;font-size:9pt">Copia de Órbita · ${p.name} · actualizada ${new Date(d.updated_at).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })}</p></body></html>`;
            const id = await drive.put({ id: ids.get(`doc:${d.id}`), name: clean(d.title), parent: dFolder, kind: 'doc', content: html });
            await save(`doc:${d.id}`, id); docs++;
          }
        }
        if (parts.includes('tasks')) {
          const [{ data: issues }, { data: epics }] = await Promise.all([
            supabase.from('issues').select('key, title, status, priority, due_date, epic_id, assignee_id, created_at, description').eq('project_id', p.id).order('number'),
            supabase.from('epics').select('id, name').eq('project_id', p.id),
          ]);
          const people = [...new Set((issues ?? []).map((i) => i.assignee_id).filter(Boolean))] as string[];
          const { data: profs } = people.length ? await supabase.from('profiles').select('id, full_name').in('id', people) : { data: [] };
          const id = await drive.put({ id: ids.get(`sheet:tasks:${p.id}`), name: `${p.name} · Tareas`, parent: pFolder, kind: 'sheet',
            content: csv([['Clave', 'Título', 'Estado', 'Prioridad', 'Épica', 'Responsable', 'Fecha límite', 'Creada', 'Descripción'],
              ...(issues ?? []).map((i) => [i.key, i.title, STATUS[i.status], PRIORITY[i.priority], epics?.find((e) => e.id === i.epic_id)?.name ?? '', profs?.find((x) => x.id === i.assignee_id)?.full_name ?? '', i.due_date ?? '', i.created_at.slice(0, 10), (i.description ?? '').slice(0, 4000)])]) });
          await save(`sheet:tasks:${p.id}`, id); sheets++;
        }
        if (parts.includes('finance')) {
          const { data: fin } = await supabase.from('finance_entries').select('concept, amount, currency, period, status, next_charge, occurred_on, note').eq('project_id', p.id).order('created_at');
          const id = await drive.put({ id: ids.get(`sheet:fin:${p.id}`), name: `${p.name} · Finanzas`, parent: pFolder, kind: 'sheet',
            content: csv([['Concepto', 'Valor', 'Moneda', 'Tipo', 'Estado', 'Próximo cobro', 'Fecha', 'Nota'], ...(fin ?? []).map((f) => [f.concept, f.amount, f.currency, PERIOD[f.period], FIN_STATUS[f.status], f.next_charge, f.occurred_on, f.note])]) });
          await save(`sheet:fin:${p.id}`, id); sheets++;
        }
      }
    }
    const message = `Copia lista: ${docs} documentos y ${sheets} hojas en la carpeta Órbita de tu Drive.`;
    await supabase.from('backup_settings').upsert({ user_id: userId, last_run: new Date().toISOString(), last_result: message, updated_at: new Date().toISOString() });
    return { ok: true, message };
  } catch (e) {
    return fail((e as Error).message);
  }
}
