import { NextResponse, type NextRequest } from 'next/server';
import { TOOLS } from './mcp-tools';

// Servidor MCP por HTTP (transporte "Streamable HTTP", sin estado y con respuestas JSON).
const VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

type Msg = { jsonrpc: '2.0'; id?: string | number | null; method: string; params?: any };

async function rpc(fn: string, args: Record<string, unknown>) {
  const r = await fetch(`${URL_}/rest/v1/rpc/${fn}`, {
    method: 'POST', cache: 'no-store',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const body = await r.json().catch(() => null);
  if (!r.ok) throw new Error(body?.message ?? `Error ${r.status}`);
  return body;
}

async function handle(m: Msg, token: string | null) {
  const ok = (result: unknown) => ({ jsonrpc: '2.0', id: m.id ?? null, result });
  const err = (code: number, message: string) => ({ jsonrpc: '2.0', id: m.id ?? null, error: { code, message } });
  switch (m.method) {
    case 'initialize': {
      const v = VERSIONS.includes(m.params?.protocolVersion) ? m.params.protocolVersion : VERSIONS[0];
      return ok({
        protocolVersion: v, capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'orbita', title: 'Órbita', version: '0.1.0' },
        instructions: 'Órbita guarda los proyectos, tareas, horario y finanzas del usuario. Llama primero a "contexto" para conocer espacios y claves de proyecto. Responde en español. Nunca borres nada.',
      });
    }
    case 'ping': return ok({});
    case 'tools/list': return ok({ tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
    case 'tools/call': {
      const tool = TOOLS.find((t) => t.name === m.params?.name);
      if (!tool) return err(-32602, 'Herramienta desconocida: ' + m.params?.name);
      if (!token) return ok({ isError: true, content: [{ type: 'text', text: 'Falta el token de Órbita. Genera uno en Órbita → Asistente.' }] });
      try {
        const data = await rpc(tool.rpc, { p_token: token, ...tool.args(m.params?.arguments ?? {}) });
        return ok({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], structuredContent: Array.isArray(data) ? { items: data } : data });
      } catch (e) {
        return ok({ isError: true, content: [{ type: 'text', text: (e as Error).message }] });
      }
    }
    default:
      if (m.method?.startsWith('notifications/')) return null;
      return err(-32601, 'Método no soportado: ' + m.method);
  }
}

export async function mcpPost(request: NextRequest, pathToken: string | null) {
  const auth = request.headers.get('authorization');
  const token = pathToken ?? (auth?.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : null);
  let body: Msg | Msg[];
  try { body = await request.json(); } catch { return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON no válido' } }, { status: 400 }); }
  const list = Array.isArray(body) ? body : [body];
  const out = (await Promise.all(list.map((m) => handle(m, token)))).filter(Boolean);
  if (!out.length) return new NextResponse(null, { status: 202 });
  return NextResponse.json(Array.isArray(body) ? out : out[0], { headers: { 'Cache-Control': 'no-store' } });
}

export function mcpGet() {
  return new NextResponse('Este servidor MCP responde por POST.', { status: 405, headers: { Allow: 'POST' } });
}
