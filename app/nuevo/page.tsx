import type { Metadata } from 'next';
import Crear from '@/components/sorteo/Crear';

export const metadata: Metadata = { title: 'Crea tu sorteo | Laymon Pizzería Artesanal', robots: { index: false, follow: false } };

export default function PaginaNuevo() {
  return <Crear />;
}
