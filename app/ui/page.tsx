import type { Metadata } from 'next';
import { Vitrine } from './Vitrine';

export const metadata: Metadata = { title: 'Design system' };

export default function PaginaUi() {
  return <Vitrine />;
}
