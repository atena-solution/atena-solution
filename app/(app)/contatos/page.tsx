import { Suspense } from 'react';
import { TelaContatos } from './TelaContatos';

export const metadata = { title: 'Contatos' };

export default function PaginaContatos() {
  return (
    <Suspense>
      <TelaContatos />
    </Suspense>
  );
}
