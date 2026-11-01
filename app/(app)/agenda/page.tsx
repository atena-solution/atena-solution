import { Suspense } from 'react';
import { TelaAgenda } from './TelaAgenda';

export const metadata = { title: 'Agenda' };

export default function PaginaAgenda() {
  return (
    <Suspense>
      <TelaAgenda />
    </Suspense>
  );
}
