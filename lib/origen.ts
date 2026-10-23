/** Las escrituras solo valen si vienen de esta misma página (evita que otro sitio mande formularios por la persona). */
export function origenValido(req: Request): boolean {
  if (req.method === 'GET' || req.method === 'HEAD') return true;
  const sitio = req.headers.get('sec-fetch-site');
  if (sitio) return sitio === 'same-origin' || sitio === 'none';
  const origen = req.headers.get('origin');
  if (!origen) return false;
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  try {
    return new URL(origen).host === host;
  } catch {
    return false;
  }
}
