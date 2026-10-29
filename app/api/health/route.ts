import { getConfig } from '@/lib/config';

export const dynamic = 'force-dynamic';

/** Para que Render sepa que el servicio está vivo. No toca datos; dice si falta base de datos o correo (sin enseñar llaves). */
export function GET() {
  const c = getConfig();
  return Response.json(
    {
      ok: true,
      commit: process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? 'local',
      almacen: c.upstashUrl && c.upstashToken ? 'upstash' : 'memoria',
      correo: c.resendKey ? (c.remitente.includes('resend.dev') ? 'prueba' : 'listo') : 'falta',
      dominio: c.baseUrl || null,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
