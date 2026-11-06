// Retirado: el guardado sin conexión tumbaba las páginas con sesión. Este archivo reemplaza al anterior en cada
// dispositivo, borra lo guardado, se da de baja y recarga las ventanas abiertas. No intercepta ninguna petición.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) await caches.delete(k);
    await self.registration.unregister();
    const abiertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    await Promise.allSettled(abiertas.map((c) => c.navigate(c.url)));
  })());
});
