import { origenValido } from './origen';
import type { Resultado, SorteoAlmacen } from './sorteo-almacen';

const SIN_CACHE = { 'Cache-Control': 'no-store' };

function responder(r: Resultado<object>): Response {
  if (r.ok) {
    const { ok: _ok, ...resto } = r;
    return Response.json({ ok: true, ...resto }, { headers: SIN_CACHE });
  }
  return Response.json({ error: r.error }, { status: r.status, headers: SIN_CACHE });
}

const ip = (req: Request) => (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'desconocida';

/** Rutas públicas del sorteo, relativas a /api/sorteo. Cada una devuelve un JSON; los errores traen `error` en español. */
export async function manejarSorteo(s: SorteoAlmacen, req: Request, ruta: string[]): Promise<Response> {
  if (req.method !== 'GET' && !origenValido(req)) return Response.json({ error: 'Petición no válida.' }, { status: 403 });
  const cuerpo = req.method === 'GET' ? {} : (((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>);
  const token = req.headers.get('x-sorteo-token');
  const texto = (v: unknown) => (typeof v === 'string' ? v : '');
  const [a, b, c] = ruta;
  const m = req.method;

  if (m === 'POST' && a === 'crear' && !b) return responder(await s.iniciarCreacion(cuerpo, ip(req)));
  if (m === 'POST' && a === 'crear' && b === 'verificar') return responder(await s.terminarCreacion(texto(cuerpo.correo), texto(cuerpo.codigo)));

  const numero = a ?? '';
  if (m === 'GET' && b === 'info') return responder(await s.infoPublica(numero));
  if (m === 'POST' && b === 'registro') return responder(await s.registrar(numero, cuerpo, ip(req)));
  if (m === 'POST' && b === 'entrar') return responder(await s.pedirEntrada(numero, texto(cuerpo.correo), ip(req)));
  if (m === 'POST' && b === 'verificar') {
    return responder(await s.verificarInvitado(numero, cuerpo.tipo === 'entrar' ? 'entrar' : 'registro', texto(cuerpo.correo), texto(cuerpo.codigo)));
  }
  if (m === 'GET' && b === 'yo') return responder(await s.estadoInvitado(numero, token));
  if (m === 'PUT' && b === 'deseos') return responder(await s.guardarDeseos(numero, token, cuerpo.deseos));
  if (m === 'POST' && b === 'sortear') return responder(await s.sortear(numero, token));
  if (m === 'POST' && b === 'revelar') return responder(await s.revelar(numero, token));

  if (b === 'org') {
    if (m === 'POST' && c === 'entrar') return responder(await s.entrarOrganizador(numero, texto(cuerpo.clave), ip(req)));
    if (m === 'GET' && !c) return responder(await s.estadoOrganizador(numero, token));
    if (m === 'PUT' && !c) return responder(await s.configurar(numero, token, cuerpo));
    if (m === 'POST' && c === 'liberar') return responder(await s.liberar(numero, token, texto(cuerpo.espacio)));
    if (m === 'POST' && c === 'codigo') return responder(await s.pedirCodigoRevelar(numero, token, ip(req)));
    if (m === 'POST' && c === 'revelar') return responder(await s.revelarTodo(numero, token, texto(cuerpo.codigo)));
  }
  return Response.json({ error: 'No encontrado.' }, { status: 404 });
}
