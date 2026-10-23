'use client';
import { useEffect, useRef, useState } from 'react';

const MODULES = [
  { k: 'proyectos', t: 'Proyectos', d: 'Tablero, backlog y épicas por proyecto. Arrastras una tarjeta y el estado cambia; cada tarea guarda su historial, subtareas y comentarios.', b: ['Claves propias (GG-12)', 'Línea del tiempo de cambios', 'Visibilidad por proyecto'],
    i: <><rect x="3" y="4" width="5" height="16" rx="1.5" /><rect x="10" y="4" width="5" height="10" rx="1.5" /><rect x="17" y="4" width="4" height="13" rx="1.5" /></> },
  { k: 'documentos', t: 'Documentos', d: 'La documentación técnica vive junto a su proyecto, en Markdown, con versiones guardadas cada vez que alguien la cambia.', b: ['Páginas por proyecto', 'Versiones automáticas', 'Búsqueda global'],
    i: <><path d="M6 3h8l4 4v14H6Z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></> },
  { k: 'calendario', t: 'Calendario', d: 'Tu semana con clases, bloques y vencimientos. Conecta Google Calendar y crea bloques que se repiten en los dos lados.', b: ['Google Calendar', 'Bloques semanales', 'Cruces a la vista'],
    i: <><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M3 10h18M8 3v4M16 3v4" /></> },
  { k: 'finanzas', t: 'Finanzas', d: 'Cada espacio lleva sus cuentas aparte. Tus gastos personales no se mezclan con los del equipo ni con los de un espacio donde eres socio.', b: ['Por espacio y por proyecto', 'Suscripciones con aviso', 'COP y USD'],
    i: <><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10h18M16 15h2" /></> },
  { k: 'mensajes', t: 'Mensajes y llamadas', d: 'Canales por espacio y proyecto, en tiempo real, con llamadas de voz, video y pantalla compartida a un toque.', b: ['Canales privados por proyecto', 'Llamadas sin instalar nada', 'Avisos en el celular'],
    i: <><path d="M4 5h16v11H9l-5 4Z" /><path d="M8 10h8" /></> },
  { k: 'asistente', t: 'Tu IA, conectada', d: 'Órbita no trae una IA propia: conectas la que ya usas por MCP. Le hablas desde su app y ella registra avances, crea tareas y te cuenta tu día.', b: ['Claude, ChatGPT y otras', 'Permisos por espacio', 'Registro de todo lo que hace'],
    i: <><path d="M9 3v4M15 3v4M7 7h10v4a5 5 0 0 1-10 0Z" /><path d="M12 16v5" /></> },
];

function Icon({ children, size = 22 }: { children: React.ReactNode; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}

/* ---------- Cielo: tres capas de estrellas con paralaje al bajar ---------- */
function Sky() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0, h = 0, dpr = 1, raf = 0, last = 0;
    type Star = { x: number; y: number; r: number; z: number; p: number };
    let stars: Star[] = [];
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = innerWidth; h = innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.min(420, Math.round((w * h) / 4200));
      stars = Array.from({ length: n }, () => {
        const z = Math.random();
        return { x: Math.random() * w, y: Math.random() * h, r: 0.3 + z * 1.25, z, p: Math.random() * Math.PI * 2 };
      });
    };
    const draw = (t: number) => {
      const sy = scrollY;
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        const y = (((s.y - sy * (0.04 + s.z * 0.22)) % h) + h) % h;
        const tw = reduce ? 1 : 0.65 + 0.35 * Math.sin(t / 900 + s.p);
        ctx.globalAlpha = (0.18 + s.z * 0.6) * tw;
        ctx.fillStyle = s.z > 0.82 ? '#e3c8ff' : '#f4f2f7';
        ctx.beginPath(); ctx.arc(s.x, y, s.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden || t - last < 33) return; // ~30 fps es suficiente para un fondo
      last = t;
      draw(t);
    };
    resize();
    addEventListener('resize', resize);
    if (reduce) { draw(0); addEventListener('scroll', () => draw(0), { passive: true }); }
    else raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={ref} className="sky" aria-hidden="true" />;
}

/* ---------- Sistema: los módulos giran alrededor del núcleo al bajar ---------- */
function System() {
  const stage = useRef<HTMLDivElement>(null);
  const sats = useRef<(HTMLDivElement | null)[]>([]);
  const [active, setActive] = useState(0);
  useEffect(() => {
    const n = MODULES.length;
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = stage.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const total = r.height - innerHeight;
      const p = Math.min(1, Math.max(0, -r.top / total));
      const step = p * (n - 1);
      const idx = Math.round(step);
      setActive((a) => (a === idx ? a : idx));
      const small = innerWidth < 760;
      const RX = small ? innerWidth * 0.4 : Math.min(innerWidth * 0.3, 430);
      const RY = small ? 70 : 120;
      sats.current.forEach((s, i) => {
        if (!s) return;
        const th = ((90 + (i - step) * (360 / n)) * Math.PI) / 180;
        const depth = Math.sin(th);
        const k = (depth + 1) / 2;
        s.style.transform = `translate3d(${Math.cos(th) * RX}px, ${depth * RY}px, 0) scale(${0.62 + 0.48 * k})`;
        s.style.opacity = String(0.25 + 0.75 * k);
        s.style.zIndex = String(Math.round(k * 100));
        s.dataset.front = String(i === idx);
      });
      el.style.setProperty('--p', p.toFixed(4));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);
    return () => { removeEventListener('scroll', onScroll); removeEventListener('resize', onScroll); cancelAnimationFrame(raf); };
  }, []);
  const m = MODULES[active];
  return (
    <section className="system" ref={stage} id="sistema" aria-label="Módulos de Órbita">
      <div className="system-pin">
        <div className="system-head">
          <span className="eyebrow">El sistema</span>
          <h2>Todo gira alrededor de <span className="serif">tu trabajo</span></h2>
        </div>
        <div className="orbit-stage">
          <svg className="orbit-path" viewBox="0 0 1000 300" preserveAspectRatio="none" aria-hidden="true"><ellipse cx="500" cy="150" rx="495" ry="145" /></svg>
          <div className="core"><img src="/logo.png" alt="" /></div>
          {MODULES.map((x, i) => (
            <div key={x.k} className="sat" ref={(el) => { sats.current[i] = el; }}>
              <span className="sat-ico"><Icon>{x.i}</Icon></span>
              <span className="sat-name">{x.t}</span>
            </div>
          ))}
        </div>
        <div className="system-card" key={m.k}>
          <span className="eyebrow">{String(active + 1).padStart(2, '0')} / {String(MODULES.length).padStart(2, '0')}</span>
          <h3>{m.t}</h3>
          <p>{m.d}</p>
          <ul>{m.b.map((b) => <li key={b}>{b}</li>)}</ul>
        </div>
        <div className="system-progress" aria-hidden="true"><i /></div>
      </div>
    </section>
  );
}

/* ---------- Aparición en arco al entrar en pantalla ---------- */
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('.reveal');
    const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.18 });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

function Phone({ children, tilt = 0 }: { children: React.ReactNode; tilt?: number }) {
  return (
    <div className="phone" style={{ ['--tilt' as string]: `${tilt}deg` }}>
      <div className="phone-screen"><div className="phone-notch" />{children}</div>
    </div>
  );
}

export function Landing() {
  useReveal();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const f = () => setScrolled(scrollY > 40);
    f(); addEventListener('scroll', f, { passive: true });
    return () => removeEventListener('scroll', f);
  }, []);

  return (
    <div className="lp">
      <Sky />
      <div className="nebula" aria-hidden="true" />
      <header className={'lp-nav' + (scrolled ? ' solid' : '')}>
        <a href="#" className="lp-brand"><img src="/logo.png" alt="" /><b>Órbita</b></a>
        <nav>
          <a href="#sistema">Sistema</a>
          <a href="#ia">Tu IA</a>
          <a href="#espacios">Espacios</a>
          <a href="#movil">Celular</a>
        </nav>
        <a className="btn ghost" href="/login">Entrar</a>
      </header>

      <main>
        {/* Portada */}
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow reveal">Un producto de FEAC Estudio</span>
            <h1 className="reveal">Todo tu trabajo,<br />en <span className="serif">órbita</span>.</h1>
            <p className="reveal">Proyectos, documentos, calendario, finanzas, mensajes y la IA que ya usas, girando alrededor de un solo lugar. En el computador y en el celular.</p>
            <div className="hero-cta reveal">
              <a className="btn solid" href="/login?modo=registro">Crear mi cuenta</a>
              <a className="btn ghost" href="/descargas/orbita.apk" download>Descargar para Android</a>
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="glow" />
            <div className="ring r1"><i /></div>
            <div className="ring r2"><i /></div>
            <div className="ring r3"><i /></div>
            <img className="hero-core" src="/logo.png" alt="" />
          </div>
          <a className="scroll-cue" href="#sistema" aria-label="Bajar"><span /></a>
        </section>

        <System />

        {/* IA por MCP */}
        <section className="ai" id="ia">
          <div className="ai-art reveal" aria-hidden="true">
            <div className="ai-ring">
              {['Claude', 'ChatGPT', 'Gemini', 'Cursor', 'Kimi', 'Otra IA'].map((n, i) => (
                <span key={n} className="ai-chip" style={{ ['--a' as string]: `${i * 60}deg` }}><b>{n}</b></span>
              ))}
            </div>
            <img src="/logo.png" alt="" className="ai-core" />
          </div>
          <div className="ai-copy">
            <span className="eyebrow reveal">Asistente por MCP</span>
            <h2 className="reveal">Habla con tu IA. <span className="serif">Órbita escucha.</span></h2>
            <p className="reveal">Pegas una dirección en Claude, ChatGPT o cualquier IA compatible, entras con tu cuenta y listo. Desde ese momento, desde el carro o caminando, le dices qué hiciste y ella lo registra.</p>
            <ol className="steps reveal">
              <li><b>Conecta</b> la dirección de Órbita como conector MCP.</li>
              <li><b>Autoriza</b> con tu cuenta. Sin copiar claves.</li>
              <li><b>Habla</b>: «registra que terminé el diseño y crea la tarea de pruebas».</li>
            </ol>
            <p className="note reveal">Tú decides qué espacios ve y qué puede hacer. Nunca borra nada, y todo lo que hace queda registrado.</p>
          </div>
        </section>

        {/* Espacios */}
        <section className="spaces" id="espacios">
          <div className="spaces-copy">
            <span className="eyebrow reveal">Espacios</span>
            <h2 className="reveal">Cada mundo, <span className="serif">en su propia órbita</span></h2>
            <p className="reveal">Tu vida personal, tu empresa y los proyectos donde eres socio viven separados. Cada persona ve solo los proyectos donde participa; la regla vive en la base de datos, no solo en la pantalla.</p>
            <div className="roles reveal">
              <div><b>Dueño</b><span>Todo el espacio</span></div>
              <div><b>Socio</b><span>Todo, con cuentas aparte</span></div>
              <div><b>Miembro</b><span>Solo sus proyectos</span></div>
              <div><b>Invitado</b><span>Solo lectura</span></div>
            </div>
          </div>
          <div className="spaces-art reveal" aria-hidden="true">
            <div className="srings">
              <div className="orb-r s1" />
              <div className="orb-r s2" />
              <div className="orb-r s3" />
            </div>
            <span className="orb-l l1">Personal</span>
            <span className="orb-l l2">Tu estudio</span>
            <span className="orb-l l3">Socios</span>
          </div>
        </section>

        {/* Celular */}
        <section className="mobile" id="movil">
          <div className="mobile-art reveal">
            <Phone tilt={-8}>
              <div className="ps-head"><small>VIERNES</small><b>Buenas tardes, <em>Ana.</em></b></div>
              <div className="ps-days">{['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => <span key={i} className={i === 4 ? 'on' : ''}>{d}<b>{19 + i}</b></span>)}</div>
              <div className="ps-card"><small>Hoy</small>
                {[['Inglés', '10:00', 'v'], ['Revisión de diseño', '15:00', 'g'], ['Clase de estadística', '18:30', 'r']].map(([t, h, c]) => <div key={t} className={'ps-row ' + c}><i /><span>{t}<small>{h}</small></span></div>)}
              </div>
              <div className="ps-card"><small>Vence pronto</small>
                {['Enviar propuesta al cliente', 'Probar pagos en sandbox'].map((t) => <div key={t} className="ps-task"><i />{t}</div>)}
              </div>
            </Phone>
            <Phone tilt={6}>
              <div className="ps-head"><small>TU IA, CONECTADA</small><b>Asistente</b></div>
              <div className="ps-card"><small>Hablar ahora</small><div className="ps-btn">Abrir Claude</div><div className="ps-btn ghost">Abrir ChatGPT</div></div>
              <div className="ps-card"><small>Lo que hizo tu IA</small>
                {['APP-14 pasó a Hecho', 'Creó APP-15: pruebas', 'Anotó gasto: dominio'].map((t) => <div key={t} className="ps-task done"><i />{t}</div>)}
              </div>
            </Phone>
          </div>
          <div className="mobile-copy">
            <span className="eyebrow reveal">En el celular</span>
            <h2 className="reveal">Tu órbita, <span className="serif">en el bolsillo</span></h2>
            <p className="reveal">Tu día, tus espacios, mensajes con llamadas, tareas que se crean en segundos y funcionan sin señal. Los avisos te llegan al momento.</p>
            <ul className="checks reveal">
              <li>Crea espacios, proyectos e invita a tu equipo</li>
              <li>Captura rápida, con dictado por voz</li>
              <li>Funciona sin conexión y sincroniza al volver</li>
            </ul>
            <a className="btn solid reveal" href="/descargas/orbita.apk" download>Descargar para Android</a>
          </div>
        </section>

        {/* Cierre */}
        <section className="final">
          <div className="final-orbit" aria-hidden="true"><div className="fo" /><div className="fo b" /></div>
          <h2 className="reveal">Entra en <span className="serif">órbita</span>.</h2>
          <p className="reveal">Crea tu cuenta, trae tus proyectos y conecta tu IA en minutos.</p>
          <div className="hero-cta reveal" style={{ justifyContent: 'center' }}>
            <a className="btn solid" href="/login?modo=registro">Crear mi cuenta</a>
            <a className="btn ghost" href="/login">Ya tengo cuenta</a>
          </div>
        </section>
      </main>

      <footer className="lp-foot">
        <span><img src="/logo.png" alt="" /> Órbita</span>
        <span>Un producto de <a href="https://feac.vercel.app" target="_blank" rel="noreferrer">FEAC Estudio</a> · Cali, Colombia</span>
      </footer>
    </div>
  );
}
