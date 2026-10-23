// Herramientas del servidor MCP de Órbita. Cada una llama a una función de la base que valida el token y los permisos.
type Schema = { type: 'object'; properties: Record<string, { type: string; description: string; enum?: string[] }>; required?: string[] };
export type Tool = { name: string; description: string; inputSchema: Schema; rpc: string; args: (a: Record<string, any>) => Record<string, unknown> };

const ESTADOS = ['todo', 'progress', 'review', 'done'];

export const TOOLS: Tool[] = [
  {
    name: 'contexto', description: 'Tus espacios, tu rol en cada uno y sus proyectos con sus claves. Úsala primero.',
    inputSchema: { type: 'object', properties: {} }, rpc: 'mcp_contexto', args: () => ({}),
  },
  {
    name: 'mi_dia', description: 'Bloques del horario de un día y tareas que vencen en los próximos 7 días.',
    inputSchema: { type: 'object', properties: { fecha: { type: 'string', description: 'AAAA-MM-DD. Por defecto, hoy en Bogotá.' } } },
    rpc: 'mcp_mi_dia', args: (a) => ({ p_fecha: a.fecha ?? null }),
  },
  {
    name: 'listar_tareas', description: 'Tareas visibles, filtrables por proyecto (clave, p. ej. GG), estado o texto.',
    inputSchema: { type: 'object', properties: {
      proyecto: { type: 'string', description: 'Clave del proyecto, p. ej. FIT' },
      estado: { type: 'string', description: 'todo, progress, review o done', enum: ESTADOS },
      texto: { type: 'string', description: 'Busca en título y descripción' },
    } },
    rpc: 'mcp_tareas', args: (a) => ({ p_proyecto: a.proyecto ?? null, p_estado: a.estado ?? null, p_texto: a.texto ?? null }),
  },
  {
    name: 'ver_tarea', description: 'Detalle de una tarea: descripción, subtareas y comentarios.',
    inputSchema: { type: 'object', properties: { clave: { type: 'string', description: 'Clave de la tarea, p. ej. GG-6' } }, required: ['clave'] },
    rpc: 'mcp_tarea', args: (a) => ({ p_clave: a.clave }),
  },
  {
    name: 'registrar_avance', description: 'Cambia el estado de una tarea y deja un comentario con qué se hizo y cómo.',
    inputSchema: { type: 'object', properties: {
      clave: { type: 'string', description: 'Clave de la tarea' },
      estado: { type: 'string', description: 'Nuevo estado (opcional)', enum: ESTADOS },
      comentario: { type: 'string', description: 'Qué se hizo y cómo, con enlaces si los hay' },
    }, required: ['clave'] },
    rpc: 'mcp_registrar_avance', args: (a) => ({ p_clave: a.clave, p_estado: a.estado ?? null, p_comentario: a.comentario ?? null }),
  },
  {
    name: 'crear_tarea', description: 'Crea una tarea en un proyecto, opcionalmente dentro de una épica.',
    inputSchema: { type: 'object', properties: {
      proyecto: { type: 'string', description: 'Clave del proyecto' },
      titulo: { type: 'string', description: 'Qué hay que hacer' },
      descripcion: { type: 'string', description: 'Detalle y cómo saber que quedó lista' },
      prioridad: { type: 'string', description: 'highest, high, medium o low', enum: ['highest', 'high', 'medium', 'low'] },
      fecha: { type: 'string', description: 'Fecha límite AAAA-MM-DD' },
      epica: { type: 'string', description: 'Clave de la épica, p. ej. GG-1' },
    }, required: ['proyecto', 'titulo'] },
    rpc: 'mcp_crear_tarea', args: (a) => ({ p_proyecto: a.proyecto, p_titulo: a.titulo, p_descripcion: a.descripcion ?? '', p_prioridad: a.prioridad ?? 'medium', p_fecha: a.fecha ?? null, p_epica: a.epica ?? null }),
  },
  {
    name: 'anotar_gasto', description: 'Anota un gasto o suscripción en las finanzas de un espacio (requiere permiso de finanzas).',
    inputSchema: { type: 'object', properties: {
      espacio: { type: 'string', description: 'Nombre del espacio, p. ej. Personal' },
      concepto: { type: 'string', description: 'Qué se pagó' },
      valor: { type: 'number', description: 'Monto' },
      moneda: { type: 'string', description: 'COP o USD', enum: ['COP', 'USD'] },
      periodo: { type: 'string', description: 'once, monthly o yearly', enum: ['once', 'monthly', 'yearly'] },
      proyecto: { type: 'string', description: 'Clave del proyecto (opcional)' },
    }, required: ['espacio', 'concepto', 'valor'] },
    rpc: 'mcp_anotar_gasto', args: (a) => ({ p_espacio: a.espacio, p_concepto: a.concepto, p_valor: a.valor, p_moneda: a.moneda ?? 'COP', p_periodo: a.periodo ?? 'once', p_proyecto: a.proyecto ?? null }),
  },
];
