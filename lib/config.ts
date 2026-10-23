/** Variables de entorno (ver .env.example). Se leen en cada llamada para que las pruebas puedan cambiarlas. */
export function getConfig() {
  const env = process.env;
  return {
    adminKey: env.ADMIN_KEY ?? '',
    secreto: env.SORTEO_SECRET ?? '',
    upstashUrl: env.UPSTASH_REDIS_REST_URL ?? '',
    upstashToken: env.UPSTASH_REDIS_REST_TOKEN ?? '',
    resendKey: (env.RESEND_API_KEY ?? '').trim(),
    remitente: env.SORTEO_REMITENTE || 'Laymon <onboarding@resend.dev>',
    baseUrl: (env.SORTEO_BASE_URL ?? '').replace(/\/$/, ''),
    whatsapp: env.WHATSAPP_NUMBER || '525535023665',
  };
}
