// Órbita sin conexión: guarda en este dispositivo las páginas ya visitadas y las muestra si no hay internet.
// Con internet siempre manda la red. Al cerrar sesión se borra todo lo guardado.
const PAGINAS = 'orbita-paginas-v1';
const ARCHIVOS = 'orbita-archivos-v1';
const FUERA = ['/api', '/auth', '/oauth', '/login', '/bienvenida', '/descargar', '/descargas', '/.well-known', '/sw.js'];

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== PAGINAS && k !== ARCHIVOS) await caches.delete(k);
    await self.clients.claim();
  })());
});

const guardable = (r) => r.ok && !r.redirected && r.type === 'basic';

async function guardarPagina(url) {
  const r = await fetch(url, { credentials: 'include', redirect: 'follow', headers: { Accept: 'text/html' } });
  if (guardable(r)) await (await caches.open(PAGINAS)).put(url, r);
}

async function pagina(request) {
  const cache = await caches.open(PAGINAS);
  const red = fetch(request).then((r) => {
    if (guardable(r)) cache.put(request.url, r.clone());
    return r;
  });
  // Con mala señal, a los 6 segundos se muestra la copia y la red sigue actualizándola por detrás.
  const copia = await cache.match(request.url);
  try {
    if (!copia) return await red;
    return await Promise.race([red, new Promise((_, no) => setTimeout(() => no(new Error('lento')), 6000))]);
  } catch {
    red.catch(() => {});
    return copia ?? sinCopia();
  }
}

function sinCopia() {
  return new Response(
    '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sin conexión · Órbita</title>' +
    '<body style="margin:0;min-height:100dvh;display:grid;place-items:center;background:#0a090c;color:#f4f2f7;font:16px system-ui;text-align:center;padding:24px">' +
    '<div><h1 style="font-size:22px;font-weight:600;margin:0 0 8px">Sin conexión</h1><p style="margin:0 0 18px;color:#a39fad">Esta página aún no se ha guardado en este dispositivo.</p>' +
    '<a href="/" style="color:#c77dff">Volver al inicio</a></div></body></html>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

async function archivo(request) {
  const cache = await caches.open(ARCHIVOS);
  const hit = await cache.match(request);
  if (hit) return hit;
  const r = await fetch(request);
  if (r.ok) cache.put(request, r.clone());
  return r;
}

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || FUERA.some((p) => url.pathname.startsWith(p))) return;
  if (url.pathname.startsWith('/_next/static/') || /\.(png|svg|woff2?)$/.test(url.pathname)) return e.respondWith(archivo(request));
  if (request.mode === 'navigate') e.respondWith(pagina(request));
});

self.addEventListener('message', (e) => {
  if (e.data?.tipo === 'borrar') e.waitUntil(caches.delete(PAGINAS));
  if (e.data?.tipo === 'guardar') e.waitUntil(Promise.allSettled(e.data.urls.map((u) => guardarPagina(new URL(u, self.location.origin).href))));
});
