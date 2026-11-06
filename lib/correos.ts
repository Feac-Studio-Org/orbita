// Correos de inicio de sesión con la marca FEAC Estudio, para los proyectos en Neon.
// Cambiar de correo = cambiar variables en Vercel, no código:
//   SMTP_HOST, SMTP_PORT (con TLS directo, 465), SMTP_USER, SMTP_PASS, CORREO_DESDE, LOGO_URL, NEON_AUTH_BASE_URL.
import crypto from 'node:crypto';
import tls from 'node:tls';

const ESTUDIO = {
  nombre: 'FEAC Estudio',
  lema: 'Software que resuelve problemas reales',
  web: 'https://feac.vercel.app',
  contacto: 'contactofeac@gmail.com',
  instagram: 'https://www.instagram.com/feac_studio',
};

const ASUNTO: Record<string, (app: string) => string> = {
  'forget-password': (app) => `Tu código para cambiar la contraseña de ${app}`,
  'email-verification': (app) => `Confirma tu correo en ${app}`,
  'sign-in': (app) => `Tu código para entrar a ${app}`,
};
const TITULO: Record<string, string> = {
  'forget-password': 'Cambia tu contraseña',
  'email-verification': 'Confirma tu correo',
  'sign-in': 'Entra a tu cuenta',
};

const esc = (s: string | number) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const SANS = "'Inter Tight',Inter,'Segoe UI',Arial,sans-serif";
const MONO = "'JetBrains Mono',ui-monospace,Menlo,Consolas,monospace";

export function plantilla({ app, titulo, codigo, enlace, minutos, logo }: { app: string; titulo: string; codigo?: string; enlace?: string; minutos: number | null; logo: string }) {
  const accion = codigo
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px"><tr><td align="center" style="padding:20px 8px;background:#1b1820;border:1px solid #2f2a38;border-radius:12px;font:600 34px/1 ${MONO};letter-spacing:9px;color:#f4f2f7">${esc(codigo)}</td></tr></table>`
    : `<p style="margin:0 0 22px"><a href="${esc(enlace ?? '')}" style="display:inline-block;padding:13px 24px;border-radius:99px;background:#9d4edd;color:#f4f2f7;font:600 15px ${SANS};text-decoration:none">Continuar en ${esc(app)}</a></p>`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${esc(titulo)}</title></head>
<body style="margin:0;padding:24px 12px;background:#0a090c">
<div style="display:none;max-height:0;overflow:hidden">${esc(titulo)} en ${esc(app)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a090c"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px">
<tr><td style="padding:4px 4px 18px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="padding-right:12px"><img src="${esc(logo)}" width="40" height="40" alt="" style="display:block;border:0"></td>
<td><div style="font:600 17px/1.2 ${SANS};color:#f4f2f7">${ESTUDIO.nombre}</div><div style="font:12px/1.4 ${SANS};color:#8f8a98">${ESTUDIO.lema}</div></td>
</tr></table></td></tr>
<tr><td style="padding:28px;background:#121016;border:1px solid #2a2631;border-radius:16px;font:15px/1.55 ${SANS};color:#b9b4c2">
<div style="margin:0 0 6px;font:500 12px/1.4 ${MONO};letter-spacing:2px;text-transform:uppercase;color:#c77dff">${esc(app)}</div>
<h1 style="margin:0 0 18px;font:600 24px/1.25 ${SANS};color:#f4f2f7">${esc(titulo)}</h1>
${accion}
<p style="margin:0">${minutos ? `Vence en ${minutos} minutos. ` : ''}Si no fuiste tú, ignora este correo: tu cuenta sigue igual.</p>
</td></tr>
<tr><td style="padding:18px 4px 0;font:12px/1.6 ${SANS};color:#7d7886">
${esc(app)} es un producto de ${ESTUDIO.nombre}.<br>
<a href="${ESTUDIO.web}" style="color:#c77dff;text-decoration:none">Sitio web</a> &nbsp;·&nbsp; <a href="${ESTUDIO.instagram}" style="color:#c77dff;text-decoration:none">Instagram</a> &nbsp;·&nbsp; <a href="mailto:${ESTUDIO.contacto}" style="color:#c77dff;text-decoration:none">${ESTUDIO.contacto}</a>
</td></tr></table>
</td></tr></table></body></html>`;
}

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');
const encabezado = (s: string) => `=?UTF-8?B?${b64(s)}?=`;
const lineas = (s: string) => s.replace(/(.{76})/g, '$1\r\n');
const limpio = (s: string) => String(s).replace(/[\r\n]/g, '');

function mensaje({ de, para, asunto, texto, html }: { de: string; para: string; asunto: string; texto: string; html: string }) {
  const borde = `feac${crypto.randomBytes(12).toString('hex')}`;
  return [
    `From: ${encabezado(ESTUDIO.nombre)} <${limpio(de)}>`,
    `To: <${limpio(para)}>`,
    `Subject: ${encabezado(asunto)}`,
    `Date: ${new Date().toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${crypto.randomUUID()}@${limpio(de).split('@')[1]}>`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${borde}"`,
    '',
    `--${borde}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    lineas(b64(texto)),
    `--${borde}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    lineas(b64(html)),
    `--${borde}--`,
    '',
  ].join('\r\n');
}

/** Cliente SMTP mínimo con TLS directo: la función no lleva dependencias. */
function enviar({ host, port, user, pass, de, para, datos }: { host: string; port: number; user: string; pass: string; de: string; para: string; datos: string }) {
  return new Promise<void>((resolve, reject) => {
    const s = tls.connect({ host, port, servername: host });
    s.setTimeout(9000, () => s.destroy(new Error('SMTP: tiempo agotado')));
    s.on('error', reject);
    const pasos: [() => string, number][] = [
      [() => 'EHLO feac', 250],
      [() => `AUTH PLAIN ${Buffer.from(`\0${user}\0${pass}`).toString('base64')}`, 235],
      [() => `MAIL FROM:<${limpio(de)}>`, 250],
      [() => `RCPT TO:<${limpio(para)}>`, 250],
      [() => 'DATA', 354],
      [() => `${datos}\r\n.`, 250],
      [() => 'QUIT', 221],
    ];
    let esperado = 220;
    let i = 0;
    let buf = '';
    s.setEncoding('utf8');
    s.on('data', (t: string) => {
      buf += t;
      const fin = buf.split('\r\n').filter(Boolean).at(-1);
      if (!fin || !/^\d{3} /.test(fin) || !buf.endsWith('\r\n')) return;
      const codigo = Number(fin.slice(0, 3));
      buf = '';
      if (codigo !== esperado) {
        s.destroy();
        return reject(new Error(`SMTP: esperaba ${esperado} y llegó ${codigo}`));
      }
      if (i === pasos.length) {
        s.end();
        return resolve();
      }
      const [orden, siguiente] = pasos[i++];
      esperado = siguiente;
      s.write(`${orden()}\r\n`);
    });
  });
}

export async function verificar(cuerpo: string, h: Headers) {
  const firma = h.get('x-neon-signature');
  const kid = h.get('x-neon-signature-kid');
  const hora = h.get('x-neon-timestamp');
  if (!firma || !kid || !hora) return false;
  if (Date.now() - parseInt(hora, 10) > 5 * 60 * 1000) return false;
  const r = await fetch(`${process.env.NEON_AUTH_BASE_URL}/.well-known/jwks.json`);
  const jwk = (await r.json()).keys.find((k: { kid: string }) => k.kid === kid);
  if (!jwk) return false;
  const [cabecera, vacio, sello] = firma.split('.');
  if (vacio !== '') return false;
  const carga = Buffer.from(`${hora}.${Buffer.from(cuerpo, 'utf8').toString('base64url')}`, 'utf8').toString('base64url');
  return crypto.verify(
    null,
    Buffer.from(`${cabecera}.${carga}`),
    crypto.createPublicKey({ key: jwk, format: 'jwk' }),
    Buffer.from(sello, 'base64url'),
  );
}

/** Arma y envía el correo de un evento de Neon. El nombre del proyecto llega en context.project_name. */
export async function enviarEvento(evento: { event_type: string; event_data: Record<string, string>; user: { email: string }; context?: { project_name?: string } }) {
  const { event_type: tipo, event_data: d, user, context } = evento;
  const e = process.env as Record<string, string>;
  const app = context?.project_name || ESTUDIO.nombre;
  const clase = tipo === 'send.otp' ? d.otp_type : d.link_type;
  const minutos = d.expires_at ? Math.max(1, Math.round((new Date(d.expires_at).getTime() - Date.now()) / 60000)) : null;
  const titulo = TITULO[clase] ?? TITULO['sign-in'];
  const datos = mensaje({
    de: e.CORREO_DESDE,
    para: user.email,
    asunto: (ASUNTO[clase] ?? ASUNTO['sign-in'])(app),
    texto: `${app} - ${titulo}\n\n${d.otp_code ? `Tu código: ${d.otp_code}` : d.link_url}\n\nSi no fuiste tú, ignora este correo.\n\n${ESTUDIO.nombre}`,
    html: plantilla({ app, titulo, codigo: d.otp_code, enlace: d.link_url, minutos, logo: e.LOGO_URL }),
  });
  await enviar({ host: e.SMTP_HOST, port: Number(e.SMTP_PORT), user: e.SMTP_USER, pass: e.SMTP_PASS, de: e.CORREO_DESDE, para: user.email, datos });
}
