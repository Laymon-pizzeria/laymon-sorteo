import type { Metadata } from 'next';
import Admin from '@/components/sorteo/Admin';

export const metadata: Metadata = { title: 'Sorteos | Laymon', robots: { index: false, follow: false } };

export default function PaginaSorteosAdmin() {
  return <Admin />;
}
