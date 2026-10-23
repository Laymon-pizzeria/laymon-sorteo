export function correoValido(c: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c) && c.length <= 200;
}

/** Manda un correo de texto con Resend. Con el remitente de prueba (onboarding@resend.dev) solo llega a la cuenta dueña; para cualquier persona hay que verificar el dominio en Resend. */
export async function enviarCorreo(
  llave: string,
  remitente: string,
  para: string,
  asunto: string,
  texto: string,
  fetchFn: typeof fetch = fetch,
): Promise<{ ok: boolean; detalle: string }> {
  const r = await fetchFn('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${llave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: remitente, to: [para], subject: asunto, text: texto }),
    signal: AbortSignal.timeout(8000),
  });
  if (r.ok) return { ok: true, detalle: `HTTP ${r.status}` };
  return { ok: false, detalle: `HTTP ${r.status} ${(await r.text().catch(() => '')).slice(0, 200)}` };
}
