/**
 * Correos del sorteo con cara de Laymon: papel blanco, tinta, rojo solo donde importa y un fantasma.
 * HTML de tablas con estilos en línea (lo único que respetan Gmail y Outlook). Chelsea Market carga en
 * Apple Mail e iOS; en Gmail cae a una letra del sistema. Brick no se usa: en correo no se entiende.
 * Siempre va también la versión de texto.
 */

const ROJO = '#EA1D3B';
const TINTA = '#0C0B0B';
const PAPEL = '#FFFDFA';
const GRIS = '#6B6B6B';
const LINEA = '#EAE5DD';
const LETRA = "'Chelsea Market', 'Trebuchet MS', Arial, sans-serif";
const PEDIR = 'https://laymonpizzeria.getjusto.com/pedir';

/** Todo lo que escribe una persona (nombre del evento, nombres) pasa por aquí antes de ir al HTML */
export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export interface Bloque {
  /** Texto normal (ya escapado o seguro) */
  parrafo?: string;
  /** Código grande, para copiar */
  codigo?: string;
  /** Pares etiqueta / valor en una caja (número de sorteo, clave…) */
  datos?: { etiqueta: string; valor: string; rojo?: boolean }[];
  /** Botón rojo */
  boton?: { texto: string; url: string };
  /** Lista corta con título */
  lista?: { titulo: string; elementos: string[] };
}

export interface Correo {
  baseUrl: string;
  /** Línea que se ve en la bandeja junto al asunto */
  vistaPrevia: string;
  titulo: string;
  pose?: 'navidad' | 'paseo' | 'ollie' | 'kickflip' | 'equilibrio' | 'tabla-en-alto' | 'agarre';
  bloques: Bloque[];
}

function bloqueHtml(b: Bloque): string {
  if (b.parrafo) return `<p style="margin:0 0 16px;font-family:${LETRA};font-size:16px;line-height:1.5;color:${TINTA};">${b.parrafo}</p>`;
  if (b.codigo) {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 18px;"><tr><td align="center" style="background:${TINTA};border-radius:14px;padding:22px 12px;font-family:${LETRA};font-size:38px;letter-spacing:10px;color:${PAPEL};">${esc(b.codigo)}</td></tr></table>`;
  }
  if (b.datos) {
    const celdas = b.datos
      .map(
        (d) =>
          `<td valign="top" style="padding:14px 16px;font-family:${LETRA};"><div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${GRIS};">${esc(d.etiqueta)}</div><div style="margin-top:6px;font-size:24px;letter-spacing:3px;color:${d.rojo ? ROJO : TINTA};">${esc(d.valor)}</div></td>`,
      )
      .join('');
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border:1px solid ${LINEA};border-radius:14px;background:#FFFFFF;"><tr>${celdas}</tr></table>`;
  }
  if (b.boton) {
    return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 20px;"><tr><td style="background:${ROJO};border:1px solid ${TINTA};border-radius:14px;"><a href="${esc(b.boton.url)}" style="display:inline-block;padding:14px 24px;font-family:${LETRA};font-size:17px;color:#FFFFFF;text-decoration:none;">${esc(b.boton.texto)}</a></td></tr></table>`;
  }
  if (b.lista) {
    const items = b.lista.elementos.map((e) => `<li style="margin:0 0 4px;">${esc(e)}</li>`).join('');
    return `<div style="margin:0 0 16px;font-family:${LETRA};"><div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${GRIS};">${esc(b.lista.titulo)}</div><ul style="margin:8px 0 0;padding-left:20px;font-size:15px;line-height:1.5;color:${TINTA};">${items}</ul></div>`;
  }
  return '';
}

export function correoHtml(c: Correo): string {
  const base = c.baseUrl.replace(/\/$/, '');
  const pose = c.pose ?? 'paseo';
  return `<!doctype html>
<html lang="es-MX"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${esc(c.titulo)}</title>
<link href="https://fonts.googleapis.com/css2?family=Chelsea+Market&display=swap" rel="stylesheet"></head>
<body style="margin:0;padding:0;background:${PAPEL};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(c.vistaPrevia)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPEL};"><tr><td align="center" style="padding:28px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
<tr><td style="padding:0 4px 18px;border-bottom:3px solid ${ROJO};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td valign="bottom"><img src="${base}/img/correo/laymon.png" width="120" height="68" alt="Laymon" style="display:block;border:0;"></td>
    <td valign="bottom" align="right"><img src="${base}/img/fantasma/poses/${pose}.png" width="70" alt="" style="display:block;border:0;"></td>
  </tr></table>
</td></tr>
<tr><td style="padding:26px 4px 6px;">
  <h1 style="margin:0 0 18px;font-family:${LETRA};font-size:26px;line-height:1.2;font-weight:normal;color:${TINTA};">${esc(c.titulo)}</h1>
  ${c.bloques.map(bloqueHtml).join('\n  ')}
</td></tr>
<tr><td style="padding:18px 4px 0;border-top:1px solid ${LINEA};font-family:${LETRA};font-size:13px;line-height:1.5;color:${GRIS};">
  ¿Y la comida del intercambio? <a href="${PEDIR}" style="color:${ROJO};">Pide pizza napolitana a Laymon</a>.<br>
  <span style="font-size:11px;letter-spacing:2px;text-transform:uppercase;">Fire food · Respect the dough · And Rock and Roll</span><br>
  Laymon Pizzería Artesanal · Coacalco
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}
