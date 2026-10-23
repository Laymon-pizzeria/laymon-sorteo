import type { Metadata } from 'next';
import Organizador from '@/components/sorteo/Organizador';
import { normalizarNumero } from '@/lib/sorteo';

export const metadata: Metadata = { title: 'Organizador | Laymon Pizzería Artesanal', robots: { index: false, follow: false } };

export default async function PaginaOrganizador({ params }: { params: Promise<{ numero: string }> }) {
  return <Organizador numero={normalizarNumero((await params).numero)} />;
}
