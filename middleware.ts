import { NextResponse, type NextRequest } from 'next/server';

/**
 * Quien abra la dirección de Render (*.onrender.com) se pasa al dominio propio (SORTEO_BASE_URL),
 * para que el navegador, los enlaces copiados y los de WhatsApp siempre digan sorteo.laymonpizzeria.com.
 * La API no se redirige: el chequeo de salud de Render y cualquier petición en curso siguen funcionando.
 */
export function middleware(req: NextRequest) {
  const base = (process.env.SORTEO_BASE_URL ?? '').replace(/\/$/, '');
  const host = (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '').toLowerCase();
  if (!base || !host.endsWith('.onrender.com')) return NextResponse.next();
  let destino: URL;
  try {
    destino = new URL(`${req.nextUrl.pathname}${req.nextUrl.search}`, base);
  } catch {
    return NextResponse.next();
  }
  if (destino.host === host) return NextResponse.next();
  return NextResponse.redirect(destino, 307);
}

export const config = {
  matcher: ['/((?!api/|_next/|img/|fonts/|favicon.ico|icon.png|apple-icon.png).*)'],
};
