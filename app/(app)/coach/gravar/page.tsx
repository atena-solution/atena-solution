import { Suspense } from 'react';
import { Gravar } from './gravar';

export const metadata = { title: 'Gravar reunião · Coach' };

export default function PaginaGravar() {
  return (
    <Suspense>
      <Gravar />
    </Suspense>
  );
}
