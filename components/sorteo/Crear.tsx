'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Aviso, CampoFecha, CampoPresupuesto, Copiar, GENEROS, InvitadosEditor, Marco, api, botonLinea, botonRojo, campo, enlaceInvitado, etiqueta, guardarLocal, invitadosVacios, nombreRepetido, nombresDe, reglasDe, tarjeta } from './ui';

interface Listo {
  numero: string;
  clave: string;
  enlace: string;
  nombre: string;
}

/** Cualquiera puede armar su propio intercambio: se verifica su correo y recibe número y clave de organizador. */
export default function Crear() {
  const [paso, setPaso] = useState<'datos' | 'codigo' | 'listo'>('datos');
  const [f, setF] = useState({ nombreCompleto: '', edad: '', genero: '', correo: '', telefono: '', aviso: false });
  const [e, setE] = useState({ nombre: '', fecha: '', limite: '' });
  const [invitados, setInvitados] = useState(invitadosVacios);
  const [codigo, setCodigo] = useState('');
  const [listo, setListo] = useState<Listo | null>(null);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const correr = async (fn: () => Promise<void>) => {
    setError('');
    setOcupado(true);
    try {
      await fn();
    } catch (x) {
      setError((x as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  if (paso === 'listo' && listo) {
    listo.enlace = enlaceInvitado(listo.numero);
    const wa = `Hola, te invito a mi intercambio "${listo.nombre}". Regístrate y saca tu nombre aquí: ${listo.enlace} (número de sorteo ${listo.numero})`;
    return (
      <Marco titulo={<>¡Listo,<br /><span className="text-lm-red">a sortear!</span></>} pose="navidad" subtitulo="También te mandamos esto a tu correo. Guarda tu clave: es la llave de organizador.">
        <section className={tarjeta}>
          <p className="m-0 font-chelsea text-[11px] uppercase tracking-[0.12em] text-lm-gray">Número de sorteo</p>
          <p className="m-0 font-brick text-[48px] leading-none tracking-[0.12em]">{listo.numero}</p>
          <p className="m-0 mt-4 font-chelsea text-[11px] uppercase tracking-[0.12em] text-lm-gray">Clave de organizador</p>
          <p className="m-0 font-brick text-[34px] leading-none tracking-[0.12em] text-lm-red">{listo.clave}</p>
        </section>
        <section className={tarjeta}>
          <h2 className="m-0 font-brick text-[26px] font-normal leading-none">Manda este enlace a tus invitados</h2>
          <input readOnly className={`${campo} mt-3`} value={listo.enlace} onFocus={(x) => x.currentTarget.select()} aria-label="Enlace para tus invitados" />
          <div className="mt-3 flex flex-wrap gap-2">
            <Copiar texto={listo.enlace} etiqueta="Copiar enlace" />
            <a className={botonLinea} target="_blank" rel="noopener noreferrer" href={`https://api.whatsapp.com/send/?text=${encodeURIComponent(wa)}`}>Compartir por WhatsApp</a>
          </div>
        </section>
        <Link href={`/${listo.numero}/organizador`} className={`${botonRojo} text-center`}>Ir a mi panel de organizador</Link>
      </Marco>
    );
  }

  if (paso === 'codigo') {
    return (
      <Marco titulo={<>Revisa tu<br />correo</>} pose="ollie" subtitulo={`Te mandamos un código de 6 números a ${f.correo}. Con él confirmamos que el correo es tuyo y creamos tu sorteo.`}>
        {error && <Aviso>{error}</Aviso>}
        <form
          className="grid gap-3"
          onSubmit={(ev) => {
            ev.preventDefault();
            void correr(async () => {
              const r = await api<Listo>('crear/verificar', { cuerpo: { correo: f.correo, codigo } });
              // Entra directo al panel de organizador sin pedirle la clave otra vez
              try {
                const s = await api<{ token: string }>(`${r.numero}/org/entrar`, { cuerpo: { clave: r.clave } });
                guardarLocal(`laymon-organizador-${r.numero}`, s.token);
              } catch {
                /* si falla, entra con su clave */
              }
              setListo(r);
              setPaso('listo');
            });
          }}
        >
          <input className={`${campo} text-center font-brick text-[28px] tracking-[0.3em]`} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={codigo} onChange={(x) => setCodigo(x.target.value.replace(/\D/g, ''))} aria-label="Código de 6 números" autoFocus />
          <button className={botonRojo} disabled={ocupado || codigo.length !== 6}>{ocupado ? 'Creando…' : 'Crear mi sorteo'}</button>
          <button type="button" className={botonLinea} onClick={() => { setError(''); setPaso('datos'); }}>Cambiar mis datos</button>
        </form>
      </Marco>
    );
  }

  const nombres = nombresDe(invitados);
  const repetido = nombreRepetido(invitados);
  const completo = e.nombre && nombres.length >= 3 && !repetido && f.nombreCompleto && f.edad && f.genero && f.correo && f.telefono && f.aviso;
  return (
    <Marco titulo={<>Crea tu<br /><span className="text-lm-red">sorteo</span></>} pose="kickflip" subtitulo="Para posadas, familia, oficina o amigos. Tú lo organizas, cada invitado saca su nombre y nadie ve lo que no le toca.">
      {error && <Aviso>{error}</Aviso>}
      <form
        className="grid gap-4"
        onSubmit={(ev) => {
          ev.preventDefault();
          void correr(async () => {
            await api('crear', {
              cuerpo: {
                nombre: e.nombre,
                fecha: e.fecha,
                limite: e.limite,
                nombres: nombres.map((n) => ({ nombre: n })),
                exclusiones: reglasDe(invitados),
                organizador: { ...f, edad: Number(f.edad) },
              },
            });
            setPaso('codigo');
          });
        }}
      >
        <section className={`${tarjeta} grid gap-3`}>
          <h2 className="m-0 font-brick text-[26px] font-normal leading-none">Tu evento</h2>
          <label>
            <span className={etiqueta}>Nombre del evento</span>
            <input className={campo} value={e.nombre} onChange={(x) => setE({ ...e, nombre: x.target.value })} placeholder="Posada de la familia" required />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className={etiqueta}>Fecha del intercambio</span>
              <CampoFecha valor={e.fecha} onChange={(v) => setE({ ...e, fecha: v })} />
            </label>
            <label>
              <span className={etiqueta}>Presupuesto límite para el regalo ($)</span>
              <CampoPresupuesto valor={e.limite} onChange={(v) => setE({ ...e, limite: v })} />
            </label>
          </div>
          <InvitadosEditor valor={invitados} onChange={setInvitados} />
          {repetido && <Aviso tipo="alerta">“{repetido}” está repetido. Agrega una inicial para distinguirlos.</Aviso>}
        </section>

        <section className={`${tarjeta} grid gap-3`}>
          <h2 className="m-0 font-brick text-[26px] font-normal leading-none">Tus datos de organizador</h2>
          <label>
            <span className={etiqueta}>Nombre completo</span>
            <input className={campo} autoComplete="name" value={f.nombreCompleto} onChange={(x) => setF({ ...f, nombreCompleto: x.target.value })} required />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className={etiqueta}>Edad</span>
              <input className={campo} type="number" inputMode="numeric" min={18} max={110} value={f.edad} onChange={(x) => setF({ ...f, edad: x.target.value })} required />
            </label>
            <label>
              <span className={etiqueta}>Género</span>
              <select className={campo} value={f.genero} onChange={(x) => setF({ ...f, genero: x.target.value })} required>
                <option value="">Elige</option>
                {GENEROS.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            <span className={etiqueta}>Correo</span>
            <input className={campo} type="email" autoComplete="email" value={f.correo} onChange={(x) => setF({ ...f, correo: x.target.value })} required />
          </label>
          <label>
            <span className={etiqueta}>Teléfono (10 dígitos)</span>
            <input className={campo} type="tel" inputMode="tel" autoComplete="tel" value={f.telefono} onChange={(x) => setF({ ...f, telefono: x.target.value })} required />
          </label>
          <label className="flex items-start gap-2 font-chelsea text-[13px] leading-snug">
            <input type="checkbox" className="mt-1" checked={f.aviso} onChange={(x) => setF({ ...f, aviso: x.target.checked })} />
            <span>Leí y acepto el <Link href="/privacidad" target="_blank" className="text-lm-red underline">aviso de privacidad</Link>.</span>
          </label>
        </section>
        <button className={botonRojo} disabled={ocupado || !completo}>{ocupado ? 'Mandando…' : 'Mandar código a mi correo'}</button>
      </form>
    </Marco>
  );
}
