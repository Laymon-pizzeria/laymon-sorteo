'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Aviso, CampoFecha, CampoPresupuesto, CampoCodigo, Copiar, InvitadosEditor, Marco, api, botonLinea, botonRojo, campo, etiqueta, guardarLocal, guardarSesion, leerLocal, leerSesion, nombreRepetido, pesos, reglasDe, tarjeta, type InvitadoEditable } from './ui';

interface Estado {
  numero: string;
  nombre: string;
  fecha: string;
  limite: number | null;
  tipo: string;
  bloqueado: boolean;
  organizador: { nombre: string; correo: string };
  espacios: { id: string; nombre: string; registrado: boolean; sorteo: boolean }[];
  exclusiones: { de: string; a: string }[];
  enlace: string;
}

const llaveToken = (n: string) => `laymon-organizador-${n}`;
/** Recién creado en esta pestaña: la clave se enseña una vez arriba del panel (y también llega por correo). */
const llaveNuevo = (n: string) => `laymon-sorteo-nuevo-${n}`;
const claveRecienCreada = (n: string): string | null => {
  try {
    return (JSON.parse(leerSesion(llaveNuevo(n)) ?? 'null') as { clave?: string } | null)?.clave ?? null;
  } catch {
    return null;
  }
};

export default function Organizador({ numero }: { numero: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [est, setEst] = useState<Estado | null>(null);
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(
    async (t: string) => {
      setEst(await api<Estado>(`${numero}/org`, { token: t }));
    },
    [numero],
  );

  useEffect(() => {
    const nueva = claveRecienCreada(numero);
    if (nueva) setClave(nueva);
    const t = leerLocal(llaveToken(numero));
    if (!t) return;
    setToken(t);
    cargar(t).catch(() => {
      guardarLocal(llaveToken(numero), null);
      setToken(null);
    });
  }, [numero, cargar]);

  // Mientras la pantalla está abierta se refresca sola para ver quién ya sorteó
  useEffect(() => {
    if (!token || !est) return;
    const id = setInterval(() => void cargar(token).catch(() => undefined), 20000);
    return () => clearInterval(id);
  }, [token, est, cargar]);

  const correr = async (fn: () => Promise<void>) => {
    setError('');
    setOk('');
    setOcupado(true);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  if (!token || !est) {
    return (
      <Marco titulo={<>Soy el<br />organizador</>} pose="agarre" baila={false} subtitulo={`Sorteo ${numero}. Entra con la clave de organizador que recibiste.`}>
        {error && <Aviso>{error}</Aviso>}
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void correr(async () => {
              const r = await api<{ token: string }>(`${numero}/org/entrar`, { cuerpo: { clave } });
              guardarLocal(llaveToken(numero), r.token);
              setToken(r.token);
              await cargar(r.token);
            });
          }}
        >
          <label>
            <span className={etiqueta}>Clave de organizador</span>
            <input className={`${campo} font-chelsea text-[22px] uppercase tracking-[0.2em]`} value={clave} onChange={(e) => setClave(e.target.value)} autoCapitalize="characters" autoComplete="off" required />
          </label>
          <button className={botonRojo} disabled={ocupado}>{ocupado ? 'Entrando…' : 'Entrar'}</button>
          <Link href={`/${numero}`} className="text-center font-chelsea text-[13px] text-lm-gray underline">Volver al sorteo</Link>
        </form>
      </Marco>
    );
  }

  return <Panel est={est} token={token} recargar={() => cargar(token)} correr={correr} ocupado={ocupado} error={error} ok={ok} setOk={setOk} salir={() => { guardarLocal(llaveToken(numero), null); setToken(null); setEst(null); }} />;
}

function Panel({ est, token, recargar, correr, ocupado, error, ok, setOk, salir }: { est: Estado; token: string; recargar: () => Promise<void>; correr: (fn: () => Promise<void>) => Promise<void>; ocupado: boolean; error: string; ok: string; setOk: (s: string) => void; salir: () => void }) {
  const base = `${est.numero}/org`;
  // El enlace lo arma el servidor con el dominio propio (SORTEO_BASE_URL), igual que en los correos
  const enlace = est.enlace;
  const [claveNueva, setClaveNueva] = useState<string | null>(null);
  useEffect(() => setClaveNueva(claveRecienCreada(est.numero)), [est.numero]);
  const [nombre, setNombre] = useState(est.nombre);
  const [fecha, setFecha] = useState(est.fecha);
  const [limite, setLimite] = useState(est.limite ? String(est.limite) : '');
  const [invitados, setInvitados] = useState<InvitadoEditable[]>(est.espacios.map((e) => ({ k: e.id, nombre: e.nombre, no: est.exclusiones.filter((x) => x.de === e.id).map((x) => x.a) })));
  const [codigoPedido, setCodigoPedido] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [pares, setPares] = useState<{ dador: string; receptor: string | null }[] | null>(null);

  const total = est.espacios.length;
  const registrados = est.espacios.filter((e) => e.registrado).length;
  const sortearon = est.espacios.filter((e) => e.sorteo).length;
  const mensajeWa = `Hola, te invito a mi intercambio "${est.nombre}". Regístrate y saca tu nombre aquí: ${enlace} (número de sorteo ${est.numero})`;

  const verRevelar = (c: string) =>
    correr(async () => {
      const r = await api<{ pares: { dador: string; receptor: string | null }[] }>(`${base}/revelar`, { cuerpo: { codigo: c }, token });
      setPares(r.pares);
      setCodigo('');
    });

  const guardar = () =>
    correr(async () => {
      const cuerpo: Record<string, unknown> = { nombre, fecha, limite };
      if (!est.bloqueado) {
        const repetido = nombreRepetido(invitados);
        if (repetido) throw new Error(`“${repetido}” está repetido. Agrega una inicial para distinguirlos.`);
        cuerpo.nombres = invitados.filter((x) => x.nombre.trim()).map((x) => ({ nombre: x.nombre.replace(/\s+/g, ' ').trim() }));
        cuerpo.exclusiones = reglasDe(invitados);
      }
      await api(base, { metodo: 'PUT', cuerpo, token });
      await recargar();
      setOk('Cambios guardados.');
    });

  return (
    <Marco titulo={<>Panel del<br /><span className="text-lm-red">organizador</span></>} pose="tabla-en-alto" subtitulo={`${est.nombre} · sorteo ${est.numero}`}>
      {error && <Aviso>{error}</Aviso>}
      {ok && <Aviso tipo="ok">{ok}</Aviso>}

      {claveNueva && (
        <section className="sorteo-pop rounded-lm border border-lm-black bg-lm-black p-5 text-lm-paper shadow-lm-card">
          <p className="m-0 font-chelsea text-[21px] leading-tight">¡Listo! Tu sorteo ya existe.</p>
          <div className="mt-4 grid gap-3">
            <div>
              <p className="m-0 font-chelsea text-[11px] uppercase tracking-[0.12em] text-[#bdb6ad]">Número</p>
              <p className="m-0 mt-1 font-chelsea text-[26px] leading-none tracking-[0.12em]">{est.numero}</p>
            </div>
            <div>
              <p className="m-0 font-chelsea text-[11px] uppercase tracking-[0.12em] text-[#bdb6ad]">Tu clave</p>
              <p className="m-0 mt-1 font-chelsea text-[26px] leading-none tracking-[0.12em] text-lm-red [overflow-wrap:anywhere]">{claveNueva}</p>
            </div>
          </div>
          <p className="m-0 mt-4 font-chelsea text-[13px] leading-snug text-[#bdb6ad]">Te la mandamos también a tu correo. Con ella entras a este panel desde cualquier celular.</p>
          <button type="button" className="mt-3 cursor-pointer border-0 bg-transparent p-0 font-chelsea text-[13px] text-lm-paper underline" onClick={() => { guardarSesion(llaveNuevo(est.numero), null); setClaveNueva(null); }}>Ya la guardé</button>
        </section>
      )}

      <section className={tarjeta}>
        <h2 className="m-0 font-chelsea text-[21px] font-normal leading-tight">Invita a tu gente</h2>
        <p className="m-0 mt-2 font-chelsea text-[13px] leading-snug text-lm-gray">Cada invitado se registra en este enlace, escribe su lista de deseos y saca su nombre.</p>
        <input readOnly className={`${campo} mt-3`} value={enlace} onFocus={(e) => e.currentTarget.select()} aria-label="Enlace para tus invitados" />
        <div className="mt-3 flex flex-wrap gap-2">
          <Copiar texto={enlace} etiqueta="Copiar enlace" />
          <a className={botonLinea} target="_blank" rel="noopener noreferrer" href={`https://api.whatsapp.com/send/?text=${encodeURIComponent(mensajeWa)}`}>Compartir por WhatsApp</a>
        </div>
      </section>

      <section className={tarjeta}>
        <h2 className="m-0 font-chelsea text-[21px] font-normal leading-tight">Cómo va</h2>
        <p className="m-0 mt-2 font-chelsea text-[14px] text-lm-gray">
          {registrados} de {total} registrados · {sortearon} de {total} ya sortearon
        </p>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#eee8e0]" aria-hidden="true">
          <div className="h-full bg-lm-red transition-[width] duration-500" style={{ width: `${total ? (sortearon / total) * 100 : 0}%` }} />
        </div>
        <ul className="m-0 mt-4 grid list-none gap-2 p-0">
          {est.espacios.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2 rounded-lm border border-lm-border px-3 py-2 font-chelsea text-[15px]">
              <span>
                {e.nombre}{' '}
                <span className={`ml-1 text-[12px] ${e.sorteo ? 'text-[#1d6334]' : e.registrado ? 'text-[#7a5200]' : 'text-lm-gray'}`}>
                  {e.sorteo ? '✓ ya sorteó' : e.registrado ? 'registrado, falta sortear' : 'sin registrarse'}
                </span>
              </span>
              {e.registrado && !e.sorteo && (
                <button className="cursor-pointer border-0 bg-transparent font-chelsea text-[12px] text-lm-red underline" disabled={ocupado} onClick={() => void correr(async () => { await api(`${base}/liberar`, { cuerpo: { espacio: e.id }, token }); await recargar(); setOk(`Liberamos el lugar de ${e.nombre}. Puede registrarse otra vez.`); })}>
                  Liberar
                </button>
              )}
            </li>
          ))}
        </ul>
        <p className="m-0 mt-3 font-chelsea text-[12px] text-lm-gray">Te mandamos un correo cada vez que alguien sortea, con quién falta. Esta pantalla se actualiza sola.</p>
      </section>

      <section className={tarjeta}>
        <h2 className="m-0 font-chelsea text-[21px] font-normal leading-tight">Datos del sorteo</h2>
        <div className="mt-3 grid gap-3">
          <label>
            <span className={etiqueta}>Nombre del evento</span>
            <input className={campo} value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className={etiqueta}>Fecha del intercambio</span>
              <CampoFecha valor={fecha} onChange={setFecha} />
            </label>
            <label>
              <span className={etiqueta}>Presupuesto límite para el regalo ($)</span>
              <CampoPresupuesto valor={limite} onChange={setLimite} />
            </label>
          </div>
          {est.bloqueado && <Aviso tipo="alerta">Ya empezó el sorteo: la lista y las reglas quedaron fijas. El nombre, la fecha y el límite todavía se pueden cambiar.</Aviso>}
          <InvitadosEditor valor={invitados} onChange={setInvitados} bloqueado={est.bloqueado} />
          <button className={botonRojo} onClick={guardar} disabled={ocupado}>{ocupado ? 'Guardando…' : 'Guardar cambios'}</button>
        </div>
      </section>

      <section className={tarjeta}>
        <h2 className="m-0 font-chelsea text-[21px] font-normal leading-tight">Ver quién le regala a quién</h2>
        <div className="mt-3 grid gap-3">
          <Aviso tipo="alerta">Ojo: si tú también participas en el intercambio, mejor no lo veas. Se pierde la magia. Para entrar te pedimos un código a tu correo ({est.organizador.correo}).</Aviso>
          {!pares && !codigoPedido && (
            <button className={botonLinea} disabled={ocupado} onClick={() => void correr(async () => { await api(`${base}/codigo`, { cuerpo: {}, token }); setCodigoPedido(true); })}>
              Mandar código a mi correo
            </button>
          )}
          {!pares && codigoPedido && (
            <form
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void verRevelar(codigo);
              }}
            >
              <CampoCodigo valor={codigo} onChange={setCodigo} onCompleto={(c) => void verRevelar(c)} disabled={ocupado} />
              <button className={botonRojo} disabled={ocupado || codigo.length !== 6}>Ver la lista</button>
            </form>
          )}
          {pares && (
            <>
              <ul className="m-0 grid list-none gap-2 p-0">
                {pares.map((p) => (
                  <li key={p.dador} className="rounded-lm border border-lm-border px-3 py-2 font-chelsea text-[15px]">
                    {p.dador} → <b>{p.receptor ?? 'todavía no sortea'}</b>
                  </li>
                ))}
              </ul>
              <button className={botonLinea} onClick={() => { setPares(null); setCodigoPedido(false); }}>Ocultar</button>
            </>
          )}
        </div>
      </section>

      <div className="flex items-center justify-between font-chelsea text-[13px] text-lm-gray">
        <Link href={`/${est.numero}`} className="text-lm-gray underline">Ver como invitado</Link>
        <button className="cursor-pointer border-0 bg-transparent font-chelsea text-[13px] text-lm-gray underline" onClick={salir}>Salir</button>
      </div>
      {est.limite !== null && <p className="m-0 text-center font-chelsea text-[12px] text-lm-gray">Límite actual: {pesos(est.limite)}</p>}
    </Marco>
  );
}
