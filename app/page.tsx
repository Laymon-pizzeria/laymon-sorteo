import type { Metadata } from 'next';
import Inicio from '@/components/sorteo/Inicio';

export const metadata: Metadata = { title: 'Sorteo de intercambio | Laymon Pizzería Artesanal', robots: { index: false, follow: false } };

export default function PaginaInicioSorteo() {
  return <Inicio />;
}
