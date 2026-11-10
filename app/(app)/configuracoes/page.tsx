import { Suspense } from 'react';
import { TelaConfiguracoes } from './TelaConfiguracoes';

export const metadata = { title: 'Configurações' };

export default function PaginaConfiguracoes() {
  return (
    <Suspense>
      <TelaConfiguracoes />
    </Suspense>
  );
}
