import { getConfig } from './config';
import { enviarCorreo } from './correo';
import { crearSorteos, type SorteoAlmacen } from './sorteo-almacen';
import { crearStoreMemoria, crearStoreUpstash, type Store } from './store';

const g = globalThis as unknown as { __sorteos?: SorteoAlmacen; __sorteoOrigen?: string };

/** El enlace de los correos: SORTEO_BASE_URL si existe; si no, el dominio desde el que se está usando (así sirve también en la URL de Render). */
export function fijarOrigenSorteo(req: Request): void {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '';
  if (host) g.__sorteoOrigen = `${host.startsWith('localhost') ? 'http' : 'https'}://${host}`;
}

async function enviar(para: string, asunto: string, texto: string): Promise<{ ok: boolean; detalle: string }> {
  const c = getConfig();
  if (!c.resendKey) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[sorteo] (sin Resend) correo para ${para}: ${asunto}\n${texto}`);
      return { ok: true, detalle: 'consola' };
    }
    return { ok: false, detalle: 'Falta RESEND_API_KEY' };
  }
  return enviarCorreo(c.resendKey, c.remitente, para, asunto, texto).catch((e: Error) => ({ ok: false, detalle: e.message }));
}

function crearStore(): Store {
  const c = getConfig();
  if (c.upstashUrl && c.upstashToken) return crearStoreUpstash(c.upstashUrl, c.upstashToken);
  if (process.env.NODE_ENV === 'production') console.warn('[sorteo] Sin UPSTASH_REDIS_REST_URL/TOKEN: todo se guarda en memoria y se pierde al reiniciar.');
  return crearStoreMemoria();
}

export function sorteos(): SorteoAlmacen {
  if (!g.__sorteos) {
    g.__sorteos = crearSorteos({
      store: crearStore(),
      secreto: getConfig().secreto || null,
      baseUrl: () => (getConfig().baseUrl || g.__sorteoOrigen || 'https://sorteo.laymonpizzeria.com').replace(/\/$/, ''),
      enviar,
    });
  }
  return g.__sorteos;
}
