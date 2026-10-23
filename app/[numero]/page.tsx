import type { Metadata } from 'next';
import Invitado from '@/components/sorteo/Invitado';
import { normalizarNumero } from '@/lib/sorteo';

export const metadata: Metadata = { title: 'Sorteo de intercambio | Laymon Pizzería Artesanal', robots: { index: false, follow: false } };

export default async function PaginaSorteo({ params }: { params: Promise<{ numero: string }> }) {
  return <Invitado numero={normalizarNumero((await params).numero)} />;
}
