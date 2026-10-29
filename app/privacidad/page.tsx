import type { Metadata } from 'next';
import Link from 'next/link';
import { getConfig } from '@/lib/config';
import { VERSION_AVISO } from '@/lib/sorteo';

export const metadata: Metadata = { title: 'Aviso de privacidad | Laymon Pizzería Artesanal', robots: { index: false, follow: false } };

const h2 = 'm-0 mt-7 font-chelsea text-[21px] font-normal leading-tight';
const p = 'm-0 mt-2 font-chelsea text-[15px] leading-[1.55]';

/** Borrador del aviso de privacidad del sorteo (LFPDPPP). Pendiente de revisión legal antes de anunciarlo. */
export default function Privacidad() {
  const wa = getConfig().whatsapp;
  return (
    <main className="mx-auto min-h-screen max-w-[640px] px-4 pb-16 pt-6">
      <Link href="/" aria-label="Sorteo de intercambio Laymon, inicio">
        <img src="/img/laymon-rojo.svg" alt="Laymon" className="h-[52px] w-auto" />
      </Link>
      <h1 className="m-0 mt-6 font-brick text-[44px] font-normal leading-[0.92]">Aviso de privacidad</h1>
      <p className={`${p} text-lm-gray`}>Sorteo de intercambio · versión {VERSION_AVISO}</p>

      <h2 className={h2}>Quién es el responsable</h2>
      <p className={p}>Laymon Pizzería Artesanal (“Laymon”), con domicilio en Belisario Domínguez 38, San Francisco Coacalco, Estado de México, es responsable de tus datos personales y de su protección.</p>

      <h2 className={h2}>Qué datos pedimos</h2>
      <p className={p}>Nombre completo, edad, género, correo electrónico, teléfono, y lo que escribas en tu lista de deseos. No pedimos datos financieros ni de salud.</p>

      <h2 className={h2}>Para qué los usamos</h2>
      <p className={p}>
        <b>Para que funcione el sorteo:</b> confirmar que tu correo es tuyo, mandarte códigos y avisos, guardar tu lugar y tu resultado, y mostrar tu lista de deseos a la persona que te toque.
      </p>
      <p className={p}>
        <b>Para conocer y contactar a nuestros clientes:</b> hacer estadísticas, mandarte promociones, novedades y ofertas de Laymon por correo, teléfono o WhatsApp. Si no quieres recibirlas, escríbenos por WhatsApp y te quitamos de la lista; el sorteo funciona igual.
      </p>

      <h2 className={h2}>Quién ve tus datos</h2>
      <p className={p}>El organizador de tu sorteo solo ve tu nombre de la lista y si ya te registraste y sorteaste; nunca tu correo, teléfono ni edad. Tus compañeros de sorteo nunca ven tus datos. Solo la persona que te toque ve tu lista de deseos.</p>
      <p className={p}>No vendemos tus datos. Los guardamos con proveedores que nos prestan el servicio (envío de correos y alojamiento en la nube) únicamente para operar este sorteo.</p>

      <h2 className={h2}>Tus derechos</h2>
      <p className={p}>
        Puedes acceder, corregir o borrar tus datos, oponerte a su uso o retirar tu consentimiento en cualquier momento escribiéndonos por WhatsApp al{' '}
        <a className="text-lm-red" href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">
          {wa.replace(/^52/, '')}
        </a>
        . Respondemos en un máximo de 20 días hábiles.
      </p>

      <h2 className={h2}>Menores de edad</h2>
      <p className={p}>Para registrarte con tus datos necesitas ser mayor de edad. Si eres menor, pídele a una persona adulta de tu familia que se registre.</p>

      <h2 className={h2}>Cambios a este aviso</h2>
      <p className={p}>Si cambia, publicamos la nueva versión en esta misma página.</p>
    </main>
  );
}
