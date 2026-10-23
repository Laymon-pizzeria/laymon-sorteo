'use client';

import { useCallback, useEffect, useState } from 'react';
import { Aviso, Copiar, ReglasEditor, botonLinea, botonRojo, campo, etiqueta, nombresDeTexto, tarjeta, type Regla } from './ui';

const CLAVE_LS = 'laymon-sorteo-clave';

interface Fila {
  numero: string;
  nombre: string;
  tipo: 'laymon' | 'personal';
  creadoEn: number;
  fecha: string;
  organizador: string;
  correoOrganizador: string;
  total: number;
  registrados: number;
  sortearon: number;
  enlace: string;
}

const cuando = (ms: number) => new Date(ms).toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', day: 'numeric', month: 'short' });

/** Administrador: crear el sorteo de un evento de Laymon, ver cómo van todos y bajar los contactos. */
export default function Admin() {
  const [clave, setClave] = useState<string | null>(null);
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [error, setError] = useState('');
  const [creado, setCreado] = useState<{ numero: string; clave: string; enlace: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [f, setF] = useState({ nombre: '', fecha: '', limite: '', nombres: '', orgNombre: '', orgCorreo: '', orgTelefono: '', clave: '' });
  const [reglas, setReglas] = useState<Regla[]>([]);

  const llamar = useCallback(
    async (init?: RequestInit, query = '') => {
      const r = await fetch(`/api/admin${query}`, { ...init, headers: { 'content-type': 'application/json', 'x-admin-key': clave ?? '' }, cache: 'no-store' });
      if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error || 'No se pudo.');
      return r;
    },
    [clave],
  );

  useEffect(() => {
    let guardada = '';
    try {
      guardada = localStorage.getItem(CLAVE_LS) ?? '';
    } catch {
      /* nada */
    }
    setClave(guardada);
  }, []);

  const cargar = useCallback(() => {
    if (!clave) return;
    llamar()
      .then(async (r) => {
        setFilas(((await r.json()) as { sorteos: Fila[] }).sorteos);
        setError('');
      })
      .catch((e: Error) => {
        setError(e.message);
        if (/Clave incorrecta/.test(e.message)) {
          try {
            localStorage.removeItem(CLAVE_LS);
          } catch {
            /* nada */
          }
          setClave('');
        }
      });
  }, [clave, llamar]);
  useEffect(cargar, [cargar]);

  const crear = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setOcupado(true);
    setError('');
    try {
      const r = await llamar({
        method: 'POST',
        body: JSON.stringify({
          nombre: f.nombre,
          fecha: f.fecha,
          limite: f.limite,
          nombres: nombresDeTexto(f.nombres).map((n) => ({ nombre: n })),
          exclusiones: reglas,
          clave: f.clave,
          organizador: { nombre: f.orgNombre, correo: f.orgCorreo, telefono: f.orgTelefono },
        }),
      });
      setCreado((await r.json()) as { numero: string; clave: string; enlace: string });
      cargar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  const bajarContactos = async () => {
    try {
      const r = await llamar(undefined, '?csv=1');
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = 'contactos-sorteos.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const nombres = nombresDeTexto(f.nombres);
  if (!clave) {
    return (
      <main className="mx-auto min-h-screen max-w-[420px] px-4 pt-10">
        <img src="/img/laymon-rojo.svg" alt="Laymon" className="h-[48px] w-auto" />
        <h1 className="m-0 mt-5 font-brick text-[40px] font-normal leading-[0.92]">Sorteos de intercambio</h1>
        <form
          className="mt-5 grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const v = (new FormData(e.currentTarget).get('clave') as string).trim();
            try {
              localStorage.setItem(CLAVE_LS, v);
            } catch {
              /* sin almacenamiento */
            }
            setClave(v);
          }}
        >
          <label><span className={etiqueta}>Clave de administrador</span><input name="clave" type="password" className={campo} autoComplete="current-password" required /></label>
          <button className={botonRojo}>Entrar</button>
        </form>
      </main>
    );
  }
  return (
    <main className="mx-auto min-h-screen max-w-[720px] px-4 pb-16 pt-6">
      <img src="/img/laymon-rojo.svg" alt="Laymon" className="h-[48px] w-auto" />
      <h1 className="m-0 mt-5 font-brick text-[44px] font-normal leading-[0.92]">Sorteos de intercambio</h1>
      <div className="mt-5 grid gap-4">
        {error && <Aviso>{error}</Aviso>}

        <section className={tarjeta}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="m-0 font-brick text-[26px] font-normal leading-none">Sorteos</h2>
            <button className={botonLinea} onClick={bajarContactos}>Bajar contactos (CSV)</button>
          </div>
          {filas === null ? (
            <p className="m-0 mt-3 font-chelsea text-lm-gray">Cargando…</p>
          ) : filas.length === 0 ? (
            <p className="m-0 mt-3 font-chelsea text-lm-gray">Todavía no hay sorteos.</p>
          ) : (
            <ul className="m-0 mt-3 grid list-none gap-2 p-0">
              {filas.map((s) => (
                <li key={s.numero} className="rounded-lm border border-lm-border px-3 py-3 font-chelsea text-[14px]">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <b className="text-[16px]">{s.nombre}</b>
                    <span className="text-lm-gray">{s.numero} · {s.tipo === 'laymon' ? 'Evento Laymon' : 'Personal'} · {cuando(s.creadoEn)}</span>
                  </div>
                  <div className="mt-1 text-lm-gray">
                    {s.organizador} ({s.correoOrganizador}) · {s.registrados}/{s.total} registrados · {s.sortearon} ya sortearon
                  </div>
                  <div className="mt-2"><Copiar texto={s.enlace} etiqueta="Copiar enlace" /></div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={tarjeta}>
          <h2 className="m-0 font-brick text-[26px] font-normal leading-none">Crear sorteo para un evento</h2>
          <p className="m-0 mt-2 font-chelsea text-[13px] leading-snug text-lm-gray">Le das al organizador el número y la clave. Él mete a sus invitados y ellos se registran en el enlace.</p>
          {creado && (
            <div className="mt-3 grid gap-2">
              <Aviso tipo="ok">Listo. Número {creado.numero} · Clave de organizador {creado.clave}</Aviso>
              <div className="flex flex-wrap gap-2">
                <Copiar texto={`Número de sorteo: ${creado.numero}\nClave de organizador: ${creado.clave}\nEnlace para invitados: ${creado.enlace}\nEntra a organizar: ${creado.enlace}/organizador`} etiqueta="Copiar datos para el organizador" />
              </div>
            </div>
          )}
          <form className="mt-3 grid gap-3" onSubmit={crear}>
            <label><span className={etiqueta}>Nombre del evento</span><input className={campo} value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} required /></label>
            <div className="grid grid-cols-2 gap-3">
              <label><span className={etiqueta}>Fecha del intercambio</span><input className={campo} value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></label>
              <label><span className={etiqueta}>Límite de gasto ($)</span><input className={campo} inputMode="numeric" value={f.limite} onChange={(e) => setF({ ...f, limite: e.target.value })} /></label>
            </div>
            <label><span className={etiqueta}>Invitados (uno por línea; el organizador los puede cambiar)</span><textarea className={`${campo} min-h-[120px]`} value={f.nombres} onChange={(e) => setF({ ...f, nombres: e.target.value })} /></label>
            <ReglasEditor nombres={nombres} reglas={reglas} onChange={setReglas} />
            <label><span className={etiqueta}>Organizador: nombre completo</span><input className={campo} value={f.orgNombre} onChange={(e) => setF({ ...f, orgNombre: e.target.value })} required /></label>
            <div className="grid grid-cols-2 gap-3">
              <label><span className={etiqueta}>Correo</span><input className={campo} type="email" value={f.orgCorreo} onChange={(e) => setF({ ...f, orgCorreo: e.target.value })} required /></label>
              <label><span className={etiqueta}>Teléfono</span><input className={campo} type="tel" value={f.orgTelefono} onChange={(e) => setF({ ...f, orgTelefono: e.target.value })} required /></label>
            </div>
            <label><span className={etiqueta}>Clave de organizador (opcional, si no la generamos)</span><input className={campo} value={f.clave} onChange={(e) => setF({ ...f, clave: e.target.value })} /></label>
            <button className={botonRojo} disabled={ocupado}>{ocupado ? 'Creando…' : 'Crear sorteo'}</button>
          </form>
        </section>
      </div>
    </main>
  );
}
