import { Suspense } from 'react';
import { Onboarding } from './Onboarding';

export const metadata = { title: 'Configurar empresa' };

export default function PaginaOnboarding() {
  return (
    <Suspense>
      <Onboarding />
    </Suspense>
  );
}
