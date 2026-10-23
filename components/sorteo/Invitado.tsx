'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Aviso, GENEROS, Marco, api, botonLinea, botonRojo, campo, etiqueta, guardarLocal, leerLocal, pesos, tarjeta } from './ui';

interface Info {
  nombre: string;
  fecha: string;
  limite: number | null;
  libres: { id: string; nombre: string }[];
  total: number;
  registrados: number;
}
interface Yo {
  evento: string;
  fecha: string;
  limite: number | null;
  nombre: string;
  deseos: string;
  yaSorteo: boolean;
}
interface Revelado {
  nombre: string;
  deseos: string;
  registrado: boolean;
  limite: number | null;
  fecha: string;
}

type Vista = 'cargando' | 'inicio' | 'registro' | 'entrar' | 'codigo' | 'panel' | 'noExiste';
const llaveToken = (n: string) => `laymon-sorteo-${n}`;

export default function Invitado({ numero }: { numero: string }) {
  const [vista, setVista] = useState<Vista>('cargando');
  const [info, setInfo] = useState<Info | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [yo, setYo] = useState<Yo | null>(null);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  // formulario de registro
  const [f, setF] = useState({ espacio: '', nombreCompleto: '', edad: '', genero: '', correo: '', telefono: '', aviso: false, sinPromos: false });
  const [codigo, setCodigo] = useState('');
  const [tipoCodigo, setTipoCodigo] = useState<'registro' | 'entrar'>('registro');

  const cargarYo = useCallback(
    async (t: string) => {
      const d = await api<Yo>(`${numero}/yo`, { token: t });
      setYo(d);
      setVista('panel');
    },
    [numero],
  );

  useEffect(() => {
    api<Info>(`${numero}/info`)
      .then(async (i) => {
        setInfo(i);
        const t = leerLocal(llaveToken(numero));
        if (t) {
          try {
            setToken(t);
            await cargarYo(t);
            return;
          } catch {
            guardarLocal(llaveToken(numero), null);
          }
        }
        setVista('inicio');
      })
      .catch(() => setVista('noExiste'));
  }, [numero, cargarYo]);

  const correr = async (fn: () => Promise<void>) => {
    setError('');
    setOcupado(true);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  if (vista === 'cargando') return <Marco titulo="Sorteo" pose="paseo"><p className="m-0 font-chelsea text-lm-gray">Cargando…</p></Marco>;
  if (vista === 'noExiste' || !info) {
    return (
      <Marco titulo={<>No lo<br />encontramos</>} pose="agarre" baila={false} subtitulo="Revisa que el número esté bien escrito o pídele el enlace de nuevo a tu organizador.">
        <Link href="/" className={`${botonRojo} text-center`}>Escribir otro número</Link>
      </Marco>
    );
  }

  const encabezado = (
    <div className={tarjeta}>
      <p className="m-0 font-chelsea text-[11px] uppercase tracking-[0.12em] text-lm-gray">Sorteo {numero}</p>
      <h2 className="m-0 mt-1 font-brick text-[30px] font-normal leading-none">{info.nombre}</h2>
      <p className="m-0 mt-2 font-chelsea text-[14px] text-lm-gray">
        {info.fecha ? `${info.fecha} · ` : ''}
        {info.limite ? `Regalo de hasta ${pesos(info.limite)}` : 'Sin límite de gasto'}
      </p>
    </div>
  );

  // ---------- Panel del invitado ----------
  if (vista === 'panel' && yo && token) {
    return <Panel numero={numero} token={token} yo={yo} recargar={() => cargarYo(token)} salir={() => { guardarLocal(llaveToken(numero), null); setToken(null); setYo(null); setVista('inicio'); }} />;
  }

  // ---------- Código del correo ----------
  if (vista === 'codigo') {
    return (
      <Marco titulo={<>Revisa tu<br />correo</>} pose="ollie" subtitulo={`Te mandamos un código de 6 números a ${f.correo}. Si no llega, mira en spam.`}>
        {error && <Aviso>{error}</Aviso>}
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void correr(async () => {
              const r = await api<{ token: string }>(`${numero}/verificar`, { cuerpo: { tipo: tipoCodigo, correo: f.correo, codigo } });
              guardarLocal(llaveToken(numero), r.token);
              setToken(r.token);
              setCodigo('');
              await cargarYo(r.token);
            });
          }}
        >
          <label>
            <span className={etiqueta}>Código</span>
            <input className={`${campo} text-center font-brick text-[28px] tracking-[0.3em]`} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))} autoFocus />
          </label>
          <button className={botonRojo} disabled={ocupado || codigo.length !== 6}>{ocupado ? 'Revisando…' : 'Entrar'}</button>
          <button type="button" className={botonLinea} onClick={() => { setError(''); setVista(tipoCodigo === 'registro' ? 'registro' : 'entrar'); }}>Cambiar mis datos</button>
        </form>
      </Marco>
    );
  }

  // ---------- Entrar con correo ----------
  if (vista === 'entrar') {
    return (
      <Marco titulo={<>Ya me<br />registré</>} pose="equilibrio" subtitulo="Escribe el correo con el que te registraste y te mandamos un código para entrar.">
        {error && <Aviso>{error}</Aviso>}
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void correr(async () => {
              await api(`${numero}/entrar`, { cuerpo: { correo: f.correo } });
              setTipoCodigo('entrar');
              setVista('codigo');
            });
          }}
        >
          <label>
            <span className={etiqueta}>Correo</span>
            <input className={campo} type="email" autoComplete="email" value={f.correo} onChange={(e) => setF({ ...f, correo: e.target.value })} required />
          </label>
          <button className={botonRojo} disabled={ocupado}>{ocupado ? 'Mandando…' : 'Mandar código'}</button>
          <button type="button" className={botonLinea} onClick={() => { setError(''); setVista('inicio'); }}>Volver</button>
        </form>
      </Marco>
    );
  }

  // ---------- Registro ----------
  if (vista === 'registro') {
    const listo = f.espacio && f.nombreCompleto && f.edad && f.genero && f.correo && f.telefono && f.aviso;
    return (
      <Marco titulo={<>Regístrate</>} pose="kickflip" subtitulo="Con estos datos entras al sorteo. Solo los usamos como dice el aviso de privacidad.">
        {encabezado}
        {error && <Aviso>{error}</Aviso>}
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void correr(async () => {
              await api(`${numero}/registro`, { cuerpo: { ...f, edad: Number(f.edad) } });
              setTipoCodigo('registro');
              setVista('codigo');
            });
          }}
        >
          <label>
            <span className={etiqueta}>¿Quién eres en la lista?</span>
            <select className={campo} value={f.espacio} onChange={(e) => setF({ ...f, espacio: e.target.value })} required>
              <option value="">Elige tu nombre</option>
              {info.libres.map((l) => (
                <option key={l.id} value={l.id}>{l.nombre}</option>
              ))}
            </select>
          </label>
          <label>
            <span className={etiqueta}>Nombre completo</span>
            <input className={campo} autoComplete="name" value={f.nombreCompleto} onChange={(e) => setF({ ...f, nombreCompleto: e.target.value })} required />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className={etiqueta}>Edad</span>
              <input className={campo} type="number" inputMode="numeric" min={18} max={110} value={f.edad} onChange={(e) => setF({ ...f, edad: e.target.value })} required />
            </label>
            <label>
              <span className={etiqueta}>Género</span>
              <select className={campo} value={f.genero} onChange={(e) => setF({ ...f, genero: e.target.value })} required>
                <option value="">Elige</option>
                {GENEROS.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            <span className={etiqueta}>Correo</span>
            <input className={campo} type="email" autoComplete="email" value={f.correo} onChange={(e) => setF({ ...f, correo: e.target.value })} required />
          </label>
          <label>
            <span className={etiqueta}>Teléfono (10 dígitos)</span>
            <input className={campo} type="tel" inputMode="tel" autoComplete="tel" value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} required />
          </label>
          <label className="flex items-start gap-2 font-chelsea text-[13px] leading-snug">
            <input type="checkbox" className="mt-1" checked={f.aviso} onChange={(e) => setF({ ...f, aviso: e.target.checked })} />
            <span>
              Leí y acepto el <Link href="/privacidad" target="_blank" className="text-lm-red underline">aviso de privacidad</Link>.
            </span>
          </label>
          <label className="flex items-start gap-2 font-chelsea text-[13px] leading-snug text-lm-gray">
            <input type="checkbox" className="mt-1" checked={f.sinPromos} onChange={(e) => setF({ ...f, sinPromos: e.target.checked })} />
            <span>No quiero recibir promociones de Laymon (puedes cambiar de opinión cuando quieras).</span>
          </label>
          <button className={botonRojo} disabled={ocupado || !listo}>{ocupado ? 'Mandando…' : 'Mandar código a mi correo'}</button>
          <button type="button" className={botonLinea} onClick={() => { setError(''); setVista('inicio'); }}>Volver</button>
        </form>
      </Marco>
    );
  }

  // ---------- Inicio ----------
  return (
    <Marco titulo={<>Tu intercambio<br /><span className="text-lm-red">te espera</span></>} pose="paseo" subtitulo="Regístrate con tus datos, escribe tu lista de deseos y saca el nombre de la persona a quien le vas a regalar.">
      {encabezado}
      <div className="grid gap-3">
        {info.libres.length > 0 ? (
          <button className={botonRojo} onClick={() => { setError(''); setVista('registro'); }}>Registrarme</button>
        ) : (
          <Aviso tipo="alerta">Ya están todos los nombres de la lista registrados.</Aviso>
        )}
        <button className={botonLinea} onClick={() => { setError(''); setVista('entrar'); }}>Ya me registré</button>
        <Link href={`/${numero}/organizador`} className="text-center font-chelsea text-[13px] text-lm-gray underline">Soy el organizador</Link>
      </div>
    </Marco>
  );
}

function Panel({ numero, token, yo, recargar, salir }: { numero: string; token: string; yo: Yo; recargar: () => Promise<void>; salir: () => void }) {
  const [deseos, setDeseos] = useState(yo.deseos);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [rev, setRev] = useState<Revelado | null>(null);

  const guardar = async () => {
    setOcupado(true);
    try {
      await api(`${numero}/deseos`, { metodo: 'PUT', cuerpo: { deseos }, token });
      setMsg({ tipo: 'ok', texto: 'Lista guardada. Quien te toque la verá.' });
    } catch (e) {
      setMsg({ tipo: 'error', texto: (e as Error).message });
    } finally {
      setOcupado(false);
    }
  };

  const sortear = async () => {
    setOcupado(true);
    setMsg(null);
    try {
      await api(`${numero}/sortear`, { cuerpo: {}, token });
      setConfirmando(false);
      await recargar();
    } catch (e) {
      setMsg({ tipo: 'error', texto: (e as Error).message });
    } finally {
      setOcupado(false);
    }
  };

  const ver = async () => {
    setOcupado(true);
    try {
      setRev(await api<Revelado>(`${numero}/revelar`, { cuerpo: {}, token }));
    } catch (e) {
      setMsg({ tipo: 'error', texto: (e as Error).message });
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Marco titulo={<>Hola,<br /><span className="text-lm-red">{yo.nombre}</span></>} pose={yo.yaSorteo ? 'tabla-en-alto' : 'equilibrio'} subtitulo={`${yo.evento}${yo.fecha ? ` · ${yo.fecha}` : ''}`}>
      {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}

      <section className={tarjeta}>
        <h2 className="m-0 font-brick text-[26px] font-normal leading-none">Tu lista de deseos</h2>
        <p className="m-0 mt-2 font-chelsea text-[13px] leading-snug text-lm-gray">Una idea por renglón (máximo 8). Solo la ve la persona que te toque.</p>
        <textarea className={`${campo} mt-3 min-h-[120px]`} rows={5} maxLength={900} value={deseos} onChange={(e) => setDeseos(e.target.value)} placeholder={'Un termo\nChocolates\nUn libro de cocina'} />
        <button className={`${botonLinea} mt-3`} onClick={guardar} disabled={ocupado}>Guardar mi lista</button>
      </section>

      <section className={tarjeta}>
        <h2 className="m-0 font-brick text-[26px] font-normal leading-none">A quién le regalas</h2>
        {!yo.yaSorteo ? (
          <>
            <p className="m-0 mt-2 font-chelsea text-[14px] leading-snug text-lm-gray">
              Se saca una sola vez y ya no se puede repetir. {yo.limite ? `Recuerda: regalo de hasta ${pesos(yo.limite)}.` : ''}
            </p>
            {!confirmando ? (
              <button className={`${botonRojo} mt-4 w-full`} onClick={() => setConfirmando(true)}>Sortear un nombre</button>
            ) : (
              <div className="mt-4 grid gap-2">
                <Aviso tipo="alerta">¿Seguro? Una vez que lo saques ya no hay vuelta atrás.</Aviso>
                <button className={botonRojo} onClick={sortear} disabled={ocupado}>{ocupado ? 'Sorteando…' : 'Sí, sortear'}</button>
                <button className={botonLinea} onClick={() => setConfirmando(false)} disabled={ocupado}>Todavía no</button>
              </div>
            )}
          </>
        ) : (
          <div className="mt-3">
            <div className="flex items-center justify-between gap-3 rounded-lm border border-[#0C0B0B] bg-[#0C0B0B] px-4 py-4 text-[#FFFDFA]">
              {rev ? (
                <span key={rev.nombre} className="sorteo-pop font-brick text-[38px] leading-none">{rev.nombre}</span>
              ) : (
                <span aria-label="Nombre oculto" className="font-brick text-[38px] leading-none tracking-[0.18em]">••••••</span>
              )}
              <button
                type="button"
                aria-label={rev ? 'Ocultar nombre' : 'Ver nombre'}
                aria-pressed={Boolean(rev)}
                disabled={ocupado}
                onClick={() => (rev ? setRev(null) : void ver())}
                className="grid h-12 w-12 shrink-0 cursor-pointer place-items-center rounded-full border border-[#FFFDFA] bg-transparent text-[#FFFDFA]"
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {rev ? (
                    <>
                      <path d="M3 3l18 18" />
                      <path d="M10.6 6.2A10.9 10.9 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3.2 3.7M6.6 6.7A17 17 0 0 0 2 12s4 6 10 6c1.6 0 3-.4 4.3-1" />
                    </>
                  ) : (
                    <>
                      <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z" />
                      <circle cx="12" cy="12" r="3" />
                    </>
                  )}
                </svg>
              </button>
            </div>
            <p className="m-0 mt-2 font-chelsea text-[12px] text-lm-gray">Toca el ojito por si se te olvida. Es un secreto.</p>
            {rev && (
              <div className="sorteo-pop mt-4 grid gap-3">
                <div className="rounded-lm border border-lm-border bg-lm-cream p-4">
                  <p className="m-0 font-chelsea text-[11px] uppercase tracking-[0.12em] text-lm-gray">Presupuesto</p>
                  <p className="m-0 mt-1 font-brick text-[28px] leading-none">{rev.limite ? `Hasta ${pesos(rev.limite)}` : 'Sin límite de gasto'}</p>
                  {rev.fecha && <p className="m-0 mt-2 font-chelsea text-[13px] text-lm-gray">Intercambio: {rev.fecha}</p>}
                </div>
                <div className="rounded-lm border border-lm-border bg-lm-cream p-4">
                  <p className="m-0 font-chelsea text-[11px] uppercase tracking-[0.12em] text-lm-gray">Lista de deseos de {rev.nombre}</p>
                  {rev.deseos ? (
                    <ul className="m-0 mt-2 grid list-none gap-1 p-0 font-chelsea text-[16px]">
                      {rev.deseos.split('\n').map((d) => (
                        <li key={d}>🎁 {d}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="m-0 mt-2 font-chelsea text-[14px] text-lm-gray">{rev.registrado ? 'Todavía no escribe su lista. Vuelve a ver más tarde.' : 'Todavía no se registra. Vuelve a ver más tarde.'}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <div className="flex items-center justify-between font-chelsea text-[13px] text-lm-gray">
        <Link href={`/${numero}/organizador`} className="text-lm-gray underline">Soy el organizador</Link>
        <button className="cursor-pointer border-0 bg-transparent font-chelsea text-[13px] text-lm-gray underline" onClick={salir}>Salir</button>
      </div>
    </Marco>
  );
}
