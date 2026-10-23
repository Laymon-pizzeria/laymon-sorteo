import { manejarSorteo } from '@/lib/sorteo-api';
import { fijarOrigenSorteo, sorteos } from '@/lib/servidor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ ruta?: string[] }> };

async function atender(req: Request, { params }: Ctx) {
  fijarOrigenSorteo(req);
  return manejarSorteo(sorteos(), req, (await params).ruta ?? []);
}

export const GET = atender;
export const POST = atender;
export const PUT = atender;
