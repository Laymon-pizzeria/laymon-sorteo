export const dynamic = 'force-dynamic';

/** Para que Render sepa que el servicio está vivo. No toca datos. */
export function GET() {
  return Response.json({ ok: true, commit: process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? 'local' }, { headers: { 'Cache-Control': 'no-store' } });
}
