import { timingSafeEqual } from 'node:crypto';
import { getConfig } from './config';

/** Revisa la clave de /admin (`x-admin-key`). Devuelve null si todo bien, o la respuesta de error. Sin ADMIN_KEY queda cerrado. */
export async function exigirAdmin(req: Request): Promise<Response | null> {
  const { adminKey } = getConfig();
  if (!adminKey) return Response.json({ error: 'El administrador no está configurado (falta ADMIN_KEY).' }, { status: 503 });
  const recibida = Buffer.from(req.headers.get('x-admin-key') ?? '');
  const esperada = Buffer.from(adminKey);
  if (recibida.length === esperada.length && timingSafeEqual(recibida, esperada)) return null;
  await new Promise((r) => setTimeout(r, 400)); // frena adivinar la clave a fuerza bruta
  return Response.json({ error: 'Clave incorrecta.' }, { status: 401 });
}
