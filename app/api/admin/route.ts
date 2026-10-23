import { exigirAdmin } from '@/lib/auth';
import { origenValido } from '@/lib/origen';
import { fijarOrigenSorteo, sorteos } from '@/lib/servidor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const csv = (filas: string[][]) => `﻿${filas.map((f) => f.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n')}`;

/** Administrador: lista de sorteos y, con ?csv=1, todas las personas registradas para contactarlas. */
export async function GET(req: Request) {
  const denegado = await exigirAdmin(req);
  if (denegado) return denegado;
  fijarOrigenSorteo(req);
  if (new URL(req.url).searchParams.get('csv') === '1') {
    return new Response(csv(await sorteos().contactos()), {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="contactos-sorteos.csv"', 'Cache-Control': 'no-store' },
    });
  }
  return Response.json({ sorteos: await sorteos().listarAdmin() }, { headers: { 'Cache-Control': 'no-store' } });
}

/** Crea un sorteo para un evento de Laymon; devuelve número y clave de organizador. */
export async function POST(req: Request) {
  const denegado = await exigirAdmin(req);
  if (denegado) return denegado;
  if (!origenValido(req)) return Response.json({ error: 'Petición no válida.' }, { status: 403 });
  fijarOrigenSorteo(req);
  const cuerpo = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const r = await sorteos().crearParaEvento(cuerpo ?? {});
  if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
  const { ok: _ok, ...datos } = r;
  return Response.json(datos, { headers: { 'Cache-Control': 'no-store' } });
}
