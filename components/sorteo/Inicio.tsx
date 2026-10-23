'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Marco, botonLinea, botonRojo, campo, etiqueta, tarjeta } from './ui';

export default function Inicio() {
  const router = useRouter();
  const [numero, setNumero] = useState('');
  return (
    <Marco titulo={<>Sorteo de<br /><span className="text-lm-red">intercambio</span></>} pose="navidad" subtitulo="Regala sin spoilers. Cada quien saca su nombre en su celular, con su lista de deseos y el límite de gasto, y nadie ve lo que no le toca.">
      <form
        className={`${tarjeta} grid gap-3`}
        onSubmit={(e) => {
          e.preventDefault();
          const n = numero.toUpperCase().replace(/[^A-Z0-9]/g, '');
          if (n) router.push(`/${n}`);
        }}
      >
        <h2 className="m-0 font-brick text-[26px] font-normal leading-none">Ya tengo un número de sorteo</h2>
        <label>
          <span className={etiqueta}>Número de sorteo</span>
          <input className={`${campo} text-center font-brick text-[28px] uppercase tracking-[0.2em]`} value={numero} onChange={(e) => setNumero(e.target.value)} maxLength={12} autoCapitalize="characters" autoComplete="off" placeholder="K7MQ4X" />
        </label>
        <button className={botonRojo} disabled={!numero.trim()}>Entrar</button>
      </form>
      <div className={`${tarjeta} grid gap-3`}>
        <h2 className="m-0 font-brick text-[26px] font-normal leading-none">Quiero organizar uno</h2>
        <p className="m-0 font-chelsea text-[14px] leading-snug text-lm-gray">Para tu posada, tu familia o tu oficina. Pones los nombres, las reglas y el límite de gasto. Es gratis.</p>
        <Link href="/nuevo" className={`${botonLinea} text-center`}>Crear mi sorteo</Link>
      </div>
    </Marco>
  );
}
