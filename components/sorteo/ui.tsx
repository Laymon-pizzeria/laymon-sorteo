'use client';

import Link from 'next/link';
import { useState } from 'react';

export const POSES = '/img/fantasma/poses';

export const campo =
  'w-full rounded-lm border border-[#d9d3cb] bg-white px-3 py-3 font-chelsea text-[16px] text-[#0C0B0B] outline-none placeholder:text-[#b3aca3] focus:border-lm-red';
export const etiqueta = 'mb-1 block font-chelsea text-[11px] uppercase tracking-[0.12em] text-lm-gray';
export const tarjeta = 'rounded-lm border border-lm-border bg-white p-5 shadow-lm-card';
export const botonRojo =
  'inline-block cursor-pointer rounded-lm border border-lm-black bg-lm-red px-5 py-[14px] font-chelsea text-[17px] leading-none text-white no-underline shadow-lm-card disabled:cursor-not-allowed disabled:opacity-50';
export const botonLinea =
  'inline-block cursor-pointer rounded-lm border border-lm-black bg-transparent px-4 py-[10px] font-chelsea text-[14px] leading-none text-lm-black no-underline disabled:cursor-not-allowed disabled:opacity-50';

/** Habla con la API del sorteo; los errores llegan ya en español. */
export async function api<T = Record<string, unknown>>(ruta: string, opciones: { metodo?: string; cuerpo?: unknown; token?: string | null } = {}): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`/api/sorteo/${ruta}`, {
      method: opciones.metodo ?? (opciones.cuerpo === undefined ? 'GET' : 'POST'),
      headers: { 'content-type': 'application/json', ...(opciones.token ? { 'x-sorteo-token': opciones.token } : {}) },
      body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
      cache: 'no-store',
    });
  } catch {
    throw new Error('Sin conexión. Revisa tu internet e inténtalo otra vez.');
  }
  const j = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error(j.error || 'Algo salió mal. Inténtalo otra vez.');
  return j;
}

export const guardarLocal = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* sin almacenamiento: la sesión dura lo que dure la pestaña */
  }
};
/** Solo dura lo que la pestaña: para enseñar la clave una vez al crear el sorteo. */
export const guardarSesion = (k: string, v: string | null) => {
  try {
    if (v === null) sessionStorage.removeItem(k);
    else sessionStorage.setItem(k, v);
  } catch {
    /* sin almacenamiento: la clave igual llega por correo */
  }
};
export const leerSesion = (k: string): string | null => {
  try {
    return sessionStorage.getItem(k);
  } catch {
    return null;
  }
};
export const leerLocal = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};

export const pesos = (n: number) => `$${n.toLocaleString('es-MX')}`;

/** Marco común: papel blanco, logo que regresa al inicio del sorteo y un fantasma que baila. */
export function Marco({ titulo, subtitulo, pose = 'paseo', baila = true, children }: { titulo: React.ReactNode; subtitulo?: React.ReactNode; pose?: string; baila?: boolean; children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-screen max-w-[640px] px-4 pb-16 pt-6">
      <Link href="/" aria-label="Sorteo de intercambio Laymon, inicio">
        <img src="/img/laymon-rojo.svg" alt="Laymon" className="h-[52px] w-auto" />
      </Link>
      <div className="mt-6 flex items-end justify-between gap-3">
        <h1 className="m-0 font-brick text-[44px] font-normal leading-[0.92] sm:text-[56px]">{titulo}</h1>
        <img src={`${POSES}/${pose}.png`} alt="" aria-hidden="true" className={`-mb-1 h-[104px] w-auto shrink-0 sm:h-[130px] ${baila ? 'sorteo-baila' : ''}`} />
      </div>
      {subtitulo && <p className="m-0 mt-3 max-w-[480px] font-chelsea text-[16px] leading-snug text-lm-gray">{subtitulo}</p>}
      <div className="mt-6 grid gap-4">{children}</div>
      <p className="m-0 mt-10 text-center font-chelsea text-[11px] uppercase tracking-[0.12em] text-lm-gray">
        Fire food · Respect the dough · And Rock and Roll ·{' '}
        <Link href="/privacidad" className="text-lm-gray underline">
          Aviso de privacidad
        </Link>
      </p>
    </main>
  );
}

export function Aviso({ tipo = 'error', children }: { tipo?: 'error' | 'ok' | 'alerta'; children: React.ReactNode }) {
  const colores = tipo === 'ok' ? 'border-[#2c8a4b] bg-[#eef8f1] text-[#1d6334]' : tipo === 'alerta' ? 'border-[#d99a1a] bg-[#fff6e0] text-[#7a5200]' : 'border-lm-red bg-[#fdecef] text-[#a8132b]';
  return (
    <p role={tipo === 'error' ? 'alert' : 'status'} className={`m-0 rounded-lm border px-4 py-3 font-chelsea text-[14px] leading-snug ${colores}`}>
      {children}
    </p>
  );
}

export function Copiar({ texto, etiqueta: nombre = 'Copiar' }: { texto: string; etiqueta?: string }) {
  const [hecho, setHecho] = useState(false);
  return (
    <button
      type="button"
      className={botonLinea}
      onClick={() => {
        void navigator.clipboard?.writeText(texto).then(() => {
          setHecho(true);
          setTimeout(() => setHecho(false), 1600);
        });
      }}
    >
      {hecho ? 'Copiado' : nombre}
    </button>
  );
}

export const GENEROS = ['Mujer', 'Hombre', 'No binario u otro', 'Prefiero no decirlo'];

export interface Regla {
  de: string;
  a: string;
  ambos: boolean;
}

/** Reglas del tipo "Ana no le puede regalar a Beto". Trabaja con nombres de la lista. */
export function ReglasEditor({ nombres, reglas, onChange, bloqueado }: { nombres: string[]; reglas: Regla[]; onChange: (r: Regla[]) => void; bloqueado?: boolean }) {
  const [de, setDe] = useState('');
  const [a, setA] = useState('');
  const [ambos, setAmbos] = useState(true);
  const agregar = () => {
    if (!de || !a || de === a) return;
    onChange([...reglas, { de, a, ambos }]);
    setDe('');
    setA('');
  };
  return (
    <div>
      <span className={etiqueta}>Reglas de exclusión (opcional)</span>
      <p className="m-0 mb-2 font-chelsea text-[13px] leading-snug text-lm-gray">Por ejemplo: que a una pareja no le toque la otra persona.</p>
      {reglas.length > 0 && (
        <ul className="m-0 mb-3 grid list-none gap-2 p-0">
          {reglas.map((r, i) => (
            <li key={`${r.de}>${r.a}`} className="flex items-center justify-between gap-2 rounded-lm border border-lm-border bg-white px-3 py-2 font-chelsea text-[14px]">
              <span>
                {r.de} no le puede regalar a {r.a}
                {r.ambos ? ' (ni al revés)' : ''}
              </span>
              {!bloqueado && (
                <button type="button" aria-label="Quitar regla" onClick={() => onChange(reglas.filter((_, j) => j !== i))} className="cursor-pointer border-0 bg-transparent font-chelsea text-[18px] text-lm-red">
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!bloqueado && (
        <div className="grid gap-2 rounded-lm border border-dashed border-[#d9d3cb] p-3">
          <div className="grid grid-cols-2 gap-2">
            <select aria-label="Quién da" value={de} onChange={(e) => setDe(e.target.value)} className={campo}>
              <option value="">Quién…</option>
              {nombres.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
            <select aria-label="A quién no" value={a} onChange={(e) => setA(e.target.value)} className={campo}>
              <option value="">no le regala a…</option>
              {nombres.filter((n) => n !== de).map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 font-chelsea text-[13px]">
            <input type="checkbox" checked={ambos} onChange={(e) => setAmbos(e.target.checked)} /> También al revés
          </label>
          <button type="button" onClick={agregar} disabled={!de || !a} className={botonLinea}>
            Agregar regla
          </button>
        </div>
      )}
    </div>
  );
}

export const nombresDeTexto = (t: string) => t.split('\n').map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean);

/** Fecha para mostrar: AAAA-MM-DD -> "19 de diciembre de 2026". Lo que no tenga ese formato (eventos viejos) se deja tal cual. */
export function fechaBonita(f: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f);
  if (!m) return f;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

const aISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Calendario real: solo fechas desde hoy hasta dentro de 3 años, así no se puede poner "34 de diciembre". */
export function CampoFecha({ valor, onChange, disabled }: { valor: string; onChange: (v: string) => void; disabled?: boolean }) {
  const hoy = new Date();
  const max = new Date(hoy.getFullYear() + 3, hoy.getMonth(), hoy.getDate());
  return <input className={campo} type="date" min={aISO(hoy)} max={aISO(max)} value={/^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} aria-label="Fecha del intercambio" />;
}

/** Presupuesto con el signo de pesos puesto. */
export function CampoPresupuesto({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-chelsea text-[16px] text-lm-gray">$</span>
      <input className={`${campo} pl-7`} inputMode="numeric" value={valor} onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} placeholder="300" aria-label="Presupuesto límite para el regalo en pesos" />
    </div>
  );
}

/** Código de 6 números del correo. Al completar el sexto número se manda solo: un toque menos. */
export function CampoCodigo({ valor, onChange, onCompleto, disabled }: { valor: string; onChange: (v: string) => void; onCompleto: (v: string) => void; disabled?: boolean }) {
  return (
    <input
      className={`${campo} text-center text-[28px] tracking-[0.35em]`}
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      value={valor}
      disabled={disabled}
      onChange={(e) => {
        const v = e.target.value.replace(/\D/g, '').slice(0, 6);
        onChange(v);
        if (v.length === 6 && v !== valor) onCompleto(v);
      }}
      aria-label="Código de 6 números"
      placeholder="••••••"
      autoFocus
    />
  );
}

export interface InvitadoEditable {
  /** Identificador estable en pantalla (el id del lugar si ya existe) */
  k: string;
  nombre: string;
  /** k de las personas a las que NO le puede regalar */
  no: string[];
}

let contador = 0;
export const nuevoInvitado = (nombre = ''): InvitadoEditable => ({ k: `n${Date.now().toString(36)}${contador++}`, nombre, no: [] });
export const invitadosVacios = (n = 3) => Array.from({ length: n }, () => nuevoInvitado());

export const nombresDe = (v: InvitadoEditable[]) => v.map((x) => x.nombre.replace(/\s+/g, ' ').trim()).filter(Boolean);
export const nombreRepetido = (v: InvitadoEditable[]): string | null => {
  const vistos = new Set<string>();
  for (const n of nombresDe(v)) {
    const l = n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (vistos.has(l)) return n;
    vistos.add(l);
  }
  return null;
};
/** Las reglas que entiende el servidor, armadas desde las casillas por invitado */
export const reglasDe = (v: InvitadoEditable[]): Regla[] =>
  v.flatMap((x) => (x.nombre.trim() ? x.no.flatMap((k) => { const o = v.find((y) => y.k === k); return o && o.nombre.trim() ? [{ de: x.nombre.replace(/\s+/g, ' ').trim(), a: o.nombre.replace(/\s+/g, ' ').trim(), ambos: false }] : []; }) : []));

/** Una casilla por invitado; en cada una se marca a quién NO le puede tocar. Nadie se saca a sí mismo, eso ya va de fábrica. */
export function InvitadosEditor({ valor, onChange, bloqueado }: { valor: InvitadoEditable[]; onChange: (v: InvitadoEditable[]) => void; bloqueado?: boolean }) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const cambiar = (k: string, f: (x: InvitadoEditable) => InvitadoEditable) => onChange(valor.map((x) => (x.k === k ? f(x) : x)));
  const quitar = (k: string) => onChange(valor.filter((x) => x.k !== k).map((x) => ({ ...x, no: x.no.filter((y) => y !== k) })));
  const total = nombresDe(valor).length;
  return (
    <div>
      <span className={etiqueta}>Invitados (mínimo 3)</span>
      <ul className="m-0 grid list-none gap-2 p-0">
        {valor.map((x, i) => {
          const otros = valor.filter((y) => y.k !== x.k && y.nombre.trim());
          return (
            <li key={x.k} className="rounded-lm border border-lm-border bg-white p-2">
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className="w-6 text-center font-chelsea text-[15px] text-lm-gray">{i + 1}</span>
                <input className={campo} value={x.nombre} onChange={(e) => cambiar(x.k, (y) => ({ ...y, nombre: e.target.value.slice(0, 40) }))} placeholder={['Ana', 'Beto', 'Carla'][i] ?? 'Nombre del invitado'} aria-label={`Invitado ${i + 1}`} disabled={bloqueado} autoComplete="off" />
                {!bloqueado && valor.length > 3 && (
                  <button type="button" aria-label={`Quitar a ${x.nombre || `invitado ${i + 1}`}`} onClick={() => quitar(x.k)} className="cursor-pointer border-0 bg-transparent px-2 font-chelsea text-[22px] leading-none text-lm-red">×</button>
                )}
              </div>
              {x.nombre.trim() && otros.length > 0 && (
                <div className="mt-1 pl-8">
                  <button type="button" onClick={() => setAbierto(abierto === x.k ? null : x.k)} className="cursor-pointer border-0 bg-transparent p-0 font-chelsea text-[12px] text-lm-gray underline" aria-expanded={abierto === x.k}>
                    {x.no.length ? `No le puede tocar: ${x.no.map((k) => valor.find((y) => y.k === k)?.nombre).filter(Boolean).join(', ')}` : 'A alguien no le puede tocar (opcional)'}
                  </button>
                  {abierto === x.k && (
                    <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={`A quién no le puede regalar ${x.nombre}`}>
                      {otros.map((o) => {
                        const on = x.no.includes(o.k);
                        return (
                          <button key={o.k} type="button" disabled={bloqueado} aria-pressed={on} onClick={() => cambiar(x.k, (y) => ({ ...y, no: on ? y.no.filter((k) => k !== o.k) : [...y.no, o.k] }))} className={`cursor-pointer rounded-full border px-3 py-1 font-chelsea text-[13px] ${on ? 'border-lm-red bg-lm-red text-white' : 'border-[#d9d3cb] bg-white text-lm-black'}`}>
                            {o.nombre}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {!bloqueado && (
        <button type="button" className={`${botonLinea} mt-2`} disabled={valor.length >= 60} onClick={() => onChange([...valor, nuevoInvitado()])}>+ Agregar invitado</button>
      )}
      <p className="m-0 mt-2 font-chelsea text-[12px] leading-snug text-lm-gray">
        {total > 0 && `Llevas ${total}. `}Nadie puede sacar su propio nombre. Si Ana no le puede regalar a Beto, márcalo en la casilla de Ana (y en la de Beto si va para los dos lados). Si dos se llaman igual, agrega una inicial: “Ana M.” y “Ana R.”.
      </p>
    </div>
  );
}
