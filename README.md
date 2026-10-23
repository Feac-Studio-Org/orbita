# Órbita (web)

Plataforma de FEAC Estudio: proyectos (tablero, backlog, épicas, documentos), calendario con Google Calendar, finanzas por espacio, mensajes, bases de datos propias y un asistente que cualquier IA conecta por MCP.

- Next.js 16 (App Router, server-first) y Supabase (proyecto `sobyskqtcbqwkdeoljve`, organización Feact Studio).
- Las reglas de acceso viven en la base (RLS): cada persona ve solo sus espacios y los proyectos donde participa.
- La app móvil está en el repositorio `orbita-movil`.

## Publicar en Vercel

1. En Vercel: **Add New → Project → Import** este repositorio. Framework: Next.js. No hay que cambiar nada más: la URL y la clave pública de Supabase ya vienen en `.env.production`.
2. Cuando Vercel te dé la dirección (hoy: `https://orbita-feac.vercel.app`), ve a Supabase → **Authentication → URL Configuration**:
   - **Site URL**: la dirección de Vercel.
   - **Redirect URLs**: agrega `https://<tu-dirección>/auth/confirmar`.
3. Entra a la dirección, crea tu cuenta y confirma el correo.

## Conectar Google Calendar (una sola vez, para que cada persona pueda vincular el suyo)

1. En [Google Cloud Console](https://console.cloud.google.com): crea un proyecto llamado Órbita.
2. **APIs y servicios → Biblioteca**: activa **Google Calendar API**.
3. **Pantalla de consentimiento de OAuth**: tipo Externo, nombre Órbita, tu correo de soporte. En Permisos agrega `.../auth/calendar.events` y `.../auth/calendar.readonly`. Mientras esté en modo Prueba, agrega como usuarios de prueba los correos que vayan a conectar su calendario.
4. **Credenciales → Crear credenciales → ID de cliente de OAuth**: tipo Aplicación web.
   - Orígenes autorizados: `https://<tu-dirección>`
   - URI de redirección autorizada: `https://<tu-dirección>/api/google/callback`
5. En Vercel → Settings → Environment Variables agrega `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` y vuelve a desplegar.
6. En Órbita → Calendario → **Conectar Google Calendar**.

El token de Google de cada persona queda en un esquema privado de la base y solo lo lee esa persona desde el servidor.

## Conectar una IA (MCP)

En Órbita → Asistente genera un token. Te da una dirección `https://<tu-dirección>/api/mcp/<token>` para pegarla en tu IA como conector MCP remoto. Si la IA permite encabezados, usa `https://<tu-dirección>/api/mcp` con `Authorization: Bearer <token>`.

Herramientas: `contexto`, `mi_dia`, `listar_tareas`, `ver_tarea`, `registrar_avance`, `crear_tarea`, `anotar_gasto`. Cada una llama a una función de la base que valida el token, los permisos por espacio y lo que el usuario autorizó.

## Desarrollo

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Reglas

- Nunca la clave `service_role` en el cliente ni en el repositorio.
- Toda tabla nueva lleva RLS y políticas. Las migraciones se aplican en Supabase con nombre descriptivo.
- Commits con la clave de la tarea al inicio, por ejemplo `ORB-12: ...`.
